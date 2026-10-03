// Neon Postgres helper (serverless-friendly, no connection pool to manage).
const { neon } = require("@neondatabase/serverless");

let sql = null;
let ready = null;

function getSql() {
  if (!process.env.DATABASE_URL) return null;
  if (!sql) sql = neon(process.env.DATABASE_URL);
  return sql;
}

// Returns a query function, creating the table on first use. Returns null if no DATABASE_URL.
async function db() {
  const s = getSql();
  if (!s) return null;
  if (!ready) {
    ready = (async () => {
      await s`CREATE TABLE IF NOT EXISTS messages (
        id          SERIAL PRIMARY KEY,
        name        TEXT NOT NULL,
        email       TEXT NOT NULL,
        type        TEXT NOT NULL,
        message     TEXT NOT NULL,
        ip_hash     TEXT,
        user_agent  TEXT,
        email_sent  BOOLEAN NOT NULL DEFAULT FALSE,
        status      TEXT NOT NULL DEFAULT 'new',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;
      await s`CREATE INDEX IF NOT EXISTS messages_ip_created_idx ON messages (ip_hash, created_at)`;
      await s`CREATE INDEX IF NOT EXISTS messages_created_idx ON messages (created_at DESC)`;
    })().catch((e) => {
      ready = null;
      throw e;
    });
  }
  await ready;
  return s;
}

module.exports = { db };
