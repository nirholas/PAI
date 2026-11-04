import { HttpError } from './http';

export interface Session {
  address: string;
  chain: 'evm' | 'sol';
  exp: number;
  uid: string;
}

const COOKIE = '__Host-sid';
const TTL_MS = 7 * 24 * 3600 * 1000;
const enc = new TextEncoder();

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
const fromB64url = (s: string) =>
  Uint8Array.from(atob(s.replaceAll('-', '+').replaceAll('_', '/')), (c) => c.charCodeAt(0));

const keys = new Map<string, Promise<CryptoKey>>();
function hmacKey(secret: string) {
  if (!secret || secret.length < 32) throw new HttpError(500, 'SESSION_SECRET is not configured');
  let k = keys.get(secret);
  if (!k) {
    k = crypto.subtle.importKey('raw', enc.encode(secret), { hash: 'SHA-256', name: 'HMAC' }, false, ['sign', 'verify']);
    keys.set(secret, k);
  }
  return k;
}

export async function issueSession(secret: string, s: Omit<Session, 'exp'>): Promise<string> {
  const payload = b64url(enc.encode(JSON.stringify({ ...s, exp: Date.now() + TTL_MS })));
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(payload)));
  return `${COOKIE}=${payload}.${b64url(sig)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${TTL_MS / 1000}`;
}

export const clearSession = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

export async function readSession(req: Request, secret: string): Promise<Session | null> {
  const raw = req.headers
    .get('cookie')
    ?.split(/;\s*/)
    .find((c) => c.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1);
  if (!raw) return null;
  const [payload, sig] = raw.split('.');
  if (!payload || !sig) return null;
  try {
    const ok = await crypto.subtle.verify('HMAC', await hmacKey(secret), fromB64url(sig), enc.encode(payload));
    if (!ok) return null;
    const s = JSON.parse(new TextDecoder().decode(fromB64url(payload))) as Session;
    return s.exp > Date.now() ? s : null;
  } catch {
    return null;
  }
}
