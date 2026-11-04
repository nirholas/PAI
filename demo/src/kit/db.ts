const KIT_SCHEMA = `
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, chain TEXT NOT NULL, address TEXT NOT NULL, created_at INTEGER NOT NULL, last_login INTEGER NOT NULL, UNIQUE(chain, address));
CREATE TABLE IF NOT EXISTS nonces (nonce TEXT PRIMARY KEY, chain TEXT NOT NULL, address TEXT NOT NULL, chain_id INTEGER, message TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS api_keys (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL, prefix TEXT NOT NULL, hash TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL, last_used INTEGER, revoked_at INTEGER);
CREATE INDEX IF NOT EXISTS api_keys_user ON api_keys(user_id);
CREATE TABLE IF NOT EXISTS usage (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, action TEXT NOT NULL, detail TEXT, ok INTEGER NOT NULL DEFAULT 1, ms INTEGER, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS usage_user ON usage(user_id, created_at DESC);
`;

let ready: Promise<void> | null = null;

/** Applies the kit tables plus the demo's own tables once per isolate. Every statement is idempotent. */
export function ensureSchema(db: D1Database, appSchema = ''): Promise<void> {
  ready ??= (async () => {
    const stmts = `${KIT_SCHEMA}\n${appSchema}`
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => db.prepare(s));
    await db.batch(stmts);
  })().catch((error) => {
    ready = null;
    throw error;
  });
  return ready;
}

export const now = () => Date.now();
