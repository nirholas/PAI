import { buildChallenge, verifyChallenge, type ChainKind } from './auth';
import { ensureSchema } from './db';
import { HttpError, json, readJson, Router, str } from './http';
import { createKey, listKeys, revokeKey, userForKey } from './keys';
import { clearSession, issueSession, readSession } from './session';

export { ensureSchema } from './db';
export { HttpError, json, readJson, Router, str } from './http';
export type { Handler } from './http';

export interface KitEnv {
  ASSETS: Fetcher;
  DB: D1Database;
  SESSION_SECRET: string;
}

export interface User {
  address: string;
  chain: ChainKind;
  id: string;
}

export interface KitOptions {
  /** Shown in the wallet signature prompt. */
  appName: string;
  /** Short lowercase token used in API key prefixes, e.g. `pai` → `sk_pai_…`. */
  keySlug: string;
}

export async function currentUser(req: Request, env: KitEnv): Promise<User | null> {
  const s = await readSession(req, env.SESSION_SECRET);
  return s ? { address: s.address, chain: s.chain, id: s.uid } : null;
}

export async function requireUser(req: Request, env: KitEnv): Promise<User> {
  const u = await currentUser(req, env);
  if (!u) throw new HttpError(401, 'Sign in with your wallet first');
  return u;
}

/** Accepts `Authorization: Bearer sk_…` (programmatic access) or a browser session. */
export async function requireKeyOrUser(req: Request, env: KitEnv, ctx: ExecutionContext): Promise<User> {
  const auth = req.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) {
    const u = await userForKey(env.DB, auth.slice(7).trim(), ctx);
    if (!u) throw new HttpError(401, 'Invalid or revoked API key');
    return u;
  }
  return requireUser(req, env);
}

export function logUsage(
  env: KitEnv,
  ctx: ExecutionContext,
  userId: string,
  action: string,
  detail: unknown,
  ok = true,
  ms?: number,
) {
  const d = typeof detail === 'string' ? detail : JSON.stringify(detail ?? null);
  ctx.waitUntil(
    env.DB.prepare('INSERT INTO usage (user_id, action, detail, ok, ms, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(userId, action, d.slice(0, 1000), ok ? 1 : 0, ms ?? null, Date.now())
      .run(),
  );
}

/** Wraps a unit of work: times it, logs success or failure to the user's usage log, rethrows failures. */
export async function metered<T>(env: KitEnv, ctx: ExecutionContext, user: User, action: string, detail: unknown, fn: () => Promise<T>): Promise<T> {
  const t = Date.now();
  try {
    const r = await fn();
    logUsage(env, ctx, user.id, action, detail, true, Date.now() - t);
    return r;
  } catch (error) {
    logUsage(env, ctx, user.id, action, { ...(typeof detail === 'object' ? detail : { detail }), error: String((error as Error).message ?? error) }, false, Date.now() - t);
    throw error;
  }
}

export function kitRoutes<E extends KitEnv>(router: Router<E>, opts: KitOptions): Router<E> {
  return router
    .post('/api/auth/challenge', async (req, env) => {
      const b = await readJson<{ address?: string; chain?: string; chainId?: number }>(req);
      if (b.chain !== 'evm' && b.chain !== 'sol') throw new HttpError(400, 'chain must be "evm" or "sol"');
      const c = buildChallenge({
        address: str(b.address, 'address', 64),
        chain: b.chain,
        chainId: b.chainId,
        origin: new URL(req.url).origin,
        statement: `Sign in to ${opts.appName}. This request does not trigger a blockchain transaction or cost any gas.`,
      });
      await env.DB.batch([
        env.DB.prepare('DELETE FROM nonces WHERE expires_at < ?').bind(Date.now()),
        env.DB.prepare('INSERT INTO nonces (nonce, chain, address, chain_id, message, expires_at) VALUES (?, ?, ?, ?, ?, ?)').bind(
          c.nonce,
          c.chain,
          c.address,
          c.chainId,
          c.message,
          c.expiresAt,
        ),
      ]);
      return json({ message: c.message, nonce: c.nonce });
    })
    .post('/api/auth/verify', async (req, env) => {
      const b = await readJson<{ nonce?: string; signature?: string }>(req);
      const nonce = str(b.nonce, 'nonce', 128);
      const signature = str(b.signature, 'signature', 4000);
      const row = await env.DB.prepare('DELETE FROM nonces WHERE nonce = ? AND expires_at > ? RETURNING chain, address, chain_id, message')
        .bind(nonce, Date.now())
        .first<{ address: string; chain: ChainKind; chain_id: number | null; message: string }>();
      if (!row) throw new HttpError(401, 'Sign-in request expired. Try again.');
      await verifyChallenge({ address: row.address, chain: row.chain, chainId: row.chain_id, message: row.message }, signature);
      const t = Date.now();
      const user = (await env.DB.prepare(
        'INSERT INTO users (id, chain, address, created_at, last_login) VALUES (?, ?, ?, ?, ?) ON CONFLICT(chain, address) DO UPDATE SET last_login = excluded.last_login RETURNING id, chain, address, created_at',
      )
        .bind(crypto.randomUUID(), row.chain, row.address, t, t)
        .first<User & { created_at: number }>())!;
      const cookie = await issueSession(env.SESSION_SECRET, { address: user.address, chain: user.chain, uid: user.id });
      return json({ user }, { headers: { 'set-cookie': cookie } });
    })
    .post('/api/auth/logout', () => json({ ok: true }, { headers: { 'set-cookie': clearSession() } }))
    .get('/api/me', async (req, env) => json({ user: await currentUser(req, env) }))
    .get('/api/keys', async (req, env) => json({ keys: await listKeys(env.DB, (await requireUser(req, env)).id) }))
    .post('/api/keys', async (req, env) => {
      const u = await requireUser(req, env);
      const b = await readJson<{ name?: string }>(req);
      return json({ key: await createKey(env.DB, u.id, str(b.name, 'name', 60), opts.keySlug) }, { status: 201 });
    })
    .delete('/api/keys/:id', async (req, env, _ctx, p) => {
      await revokeKey(env.DB, (await requireUser(req, env)).id, p.id);
      return json({ ok: true });
    })
    .get('/api/usage', async (req, env) => {
      const u = await requireUser(req, env);
      const since = Date.now() - 30 * 24 * 3600 * 1000;
      const [recent, totals] = await env.DB.batch([
        env.DB.prepare('SELECT action, detail, ok, ms, created_at FROM usage WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').bind(u.id),
        env.DB.prepare('SELECT action, COUNT(*) AS calls, SUM(1 - ok) AS errors FROM usage WHERE user_id = ? AND created_at > ? GROUP BY action ORDER BY calls DESC').bind(
          u.id,
          since,
        ),
      ]);
      return json({ recent: recent.results, totals: totals.results });
    });
}

/** Standard fetch entry: schema, kit + app routes, then static assets. */
export function serve<E extends KitEnv>(router: Router<E>, appSchema = '') {
  return async (req: Request, env: E, ctx: ExecutionContext): Promise<Response> => {
    await ensureSchema(env.DB, appSchema);
    const res = await router.handle(req, env, ctx);
    return res ?? env.ASSETS.fetch(req);
  };
}
