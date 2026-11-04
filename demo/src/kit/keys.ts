import { base58 } from '@scure/base';

import { HttpError } from './http';

export async function sha256Hex(s: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
  return [...d].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export interface ApiKeyRow {
  created_at: number;
  id: string;
  last_used: number | null;
  name: string;
  prefix: string;
}

const MAX_KEYS = 10;

export async function createKey(db: D1Database, userId: string, name: string, slug: string) {
  const { n } = (await db
    .prepare('SELECT COUNT(*) AS n FROM api_keys WHERE user_id = ? AND revoked_at IS NULL')
    .bind(userId)
    .first<{ n: number }>())!;
  if (n >= MAX_KEYS) throw new HttpError(409, `You can have at most ${MAX_KEYS} active keys. Revoke one first.`);
  const secret = `sk_${slug}_${base58.encode(crypto.getRandomValues(new Uint8Array(24)))}`;
  const id = crypto.randomUUID();
  const prefix = `${secret.slice(0, slug.length + 8)}…`;
  const createdAt = Date.now();
  await db
    .prepare('INSERT INTO api_keys (id, user_id, name, prefix, hash, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, userId, name, prefix, await sha256Hex(secret), createdAt)
    .run();
  return { created_at: createdAt, id, last_used: null, name, prefix, secret };
}

export async function listKeys(db: D1Database, userId: string) {
  const { results } = await db
    .prepare('SELECT id, name, prefix, created_at, last_used FROM api_keys WHERE user_id = ? AND revoked_at IS NULL ORDER BY created_at DESC')
    .bind(userId)
    .all<ApiKeyRow>();
  return results;
}

export async function revokeKey(db: D1Database, userId: string, id: string) {
  const r = await db
    .prepare('UPDATE api_keys SET revoked_at = ? WHERE id = ? AND user_id = ? AND revoked_at IS NULL')
    .bind(Date.now(), id, userId)
    .run();
  if (!r.meta.changes) throw new HttpError(404, 'Key not found');
}

export async function userForKey(db: D1Database, secret: string, ctx: ExecutionContext) {
  const hash = await sha256Hex(secret);
  const row = await db
    .prepare('SELECT k.id AS key_id, u.id, u.chain, u.address FROM api_keys k JOIN users u ON u.id = k.user_id WHERE k.hash = ? AND k.revoked_at IS NULL')
    .bind(hash)
    .first<{ address: string; chain: 'evm' | 'sol'; id: string; key_id: string }>();
  if (!row) return null;
  ctx.waitUntil(db.prepare('UPDATE api_keys SET last_used = ? WHERE id = ?').bind(Date.now(), row.key_id).run());
  return { address: row.address, chain: row.chain, id: row.id };
}
