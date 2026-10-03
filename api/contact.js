// POST /api/contact
// 1) validates  2) rate-limits per visitor  3) saves to Postgres  4) emails you via Resend
const crypto = require("crypto");
const { db } = require("./_lib/db");

const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Per-visitor limit (per IP, not total). Default 30/hour; set RATE_LIMIT_PER_HOUR=0 to turn the limit off.
const _lim = parseInt(process.env.RATE_LIMIT_PER_HOUR, 10);
const MAX_PER_HOUR = Number.isFinite(_lim) && _lim >= 0 ? _lim : 30;

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  let body = req.body || {};
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: "Invalid JSON" }); }
  }

  // Honeypot: bots fill this hidden field. Pretend success and drop it.
  if (body.website) return res.status(200).json({ ok: true });

  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim();
  const type = String(body.type || "Other").trim().slice(0, 60);
  const message = String(body.message || "").trim();

  if (name.length < 2 || name.length > 100) return res.status(400).json({ error: "Invalid name" });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) return res.status(400).json({ error: "Invalid email" });
  if (message.length < 10 || message.length > 5000) return res.status(400).json({ error: "Invalid message" });

  const { RESEND_API_KEY, CONTACT_TO_EMAIL, CONTACT_FROM_EMAIL, IP_SALT, ADMIN_TOKEN, DATABASE_URL } = process.env;
  const canEmail = !!(RESEND_API_KEY && CONTACT_TO_EMAIL);
  if (!canEmail && !DATABASE_URL) {
    console.error("Neither email (RESEND_API_KEY + CONTACT_TO_EMAIL) nor DATABASE_URL is configured");
    return res.status(500).json({ error: "Server not configured" });
  }

  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").split(",")[0].trim();
  const ipHash = crypto.createHash("sha256").update((IP_SALT || ADMIN_TOKEN || "salt") + ip).digest("hex").slice(0, 32);
  const ua = String(req.headers["user-agent"] || "").slice(0, 300);

  // --- database: rate limit check (skipped when the limit is 0) ---
  let sql = null;
  try {
    sql = await db();
    if (sql && MAX_PER_HOUR > 0) {
      const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM messages WHERE ip_hash = ${ipHash} AND created_at > NOW() - INTERVAL '1 hour'`;
      if (n >= MAX_PER_HOUR) return res.status(429).json({ error: "Too many messages. Please try again later." });
    }
  } catch (err) {
    console.error("DB error", err);
    sql = null; // keep going: email can still deliver the message
  }

  // --- save to database and send the email at the same time (faster) ---
  const saveToDb = async () => {
    if (!sql) return null;
    try {
      const rows = await sql`INSERT INTO messages (name, email, type, message, ip_hash, user_agent)
        VALUES (${name}, ${email}, ${type}, ${message}, ${ipHash}, ${ua}) RETURNING id`;
      return rows[0].id;
    } catch (err) {
      console.error("DB insert error", err);
      return null;
    }
  };

  const sendEmail = async () => {
    if (!canEmail) return false;
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: CONTACT_FROM_EMAIL || "Portfolio <onboarding@resend.dev>",
          to: [CONTACT_TO_EMAIL],
          reply_to: email,
          subject: `Project inquiry: ${type} — ${name}`,
          text: `${message}\n\nFrom: ${name} (${email})\nProject type: ${type}`,
          html: `<p>${esc(message).replace(/\n/g, "<br>")}</p><hr><p><b>From:</b> ${esc(name)} (${esc(email)})<br><b>Project type:</b> ${esc(type)}</p>`,
        }),
      });
      if (r.ok) return true;
      console.error("Resend error", r.status, await r.text());
    } catch (err) {
      console.error("Email error", err);
    }
    return false;
  };

  const [id, emailed] = await Promise.all([saveToDb(), sendEmail()]);

  if (sql && id && emailed) {
    try { await sql`UPDATE messages SET email_sent = TRUE WHERE id = ${id}`; } catch (e) { console.error(e); }
  }

  // Success if the message was saved OR emailed (never lose a message silently).
  if (id || emailed) return res.status(200).json({ ok: true });
  return res.status(502).json({ error: "Could not deliver message" });
};
