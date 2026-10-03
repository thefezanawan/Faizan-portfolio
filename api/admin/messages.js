// Private inbox API, protected by ADMIN_TOKEN (sent as "Authorization: Bearer <token>").
//   GET    /api/admin/messages?limit=50&offset=0 -> list (newest first) + total
//   PATCH  /api/admin/messages            -> { id, status: "new" | "read" }
//   DELETE /api/admin/messages?id=123
const crypto = require("crypto");
const { db } = require("../_lib/db");

function authorised(req) {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return false;
  const given = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const a = crypto.createHash("sha256").update(given).digest();
  const b = crypto.createHash("sha256").update(token).digest();
  return crypto.timingSafeEqual(a, b);
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!authorised(req)) return res.status(401).json({ error: "Unauthorized" });

  try {
    const sql = await db();
    if (!sql) return res.status(500).json({ error: "DATABASE_URL not configured" });

    if (req.method === "GET") {
      const limit = Math.min(Math.max(parseInt(req.query?.limit, 10) || 50, 1), 500);
      const offset = Math.max(parseInt(req.query?.offset, 10) || 0, 0);
      const [rows, [{ total }]] = await Promise.all([
        sql`SELECT id, name, email, type, message, email_sent, status, created_at
            FROM messages ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
        sql`SELECT COUNT(*)::int AS total FROM messages`,
      ]);
      return res.status(200).json({ messages: rows, total });
    }

    let body = req.body || {};
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }

    if (req.method === "PATCH") {
      const id = parseInt(body.id, 10);
      const status = body.status === "read" ? "read" : "new";
      if (!id) return res.status(400).json({ error: "Missing id" });
      await sql`UPDATE messages SET status = ${status} WHERE id = ${id}`;
      return res.status(200).json({ ok: true });
    }

    if (req.method === "DELETE") {
      const id = parseInt(req.query?.id || body.id, 10);
      if (!id) return res.status(400).json({ error: "Missing id" });
      await sql`DELETE FROM messages WHERE id = ${id}`;
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, PATCH, DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
};
