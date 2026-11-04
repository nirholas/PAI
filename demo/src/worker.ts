import { HttpError, json, kitRoutes, metered, readJson, requireKeyOrUser, requireUser, Router, serve, str, type KitEnv, type User } from './kit';

const REPO = 'nirholas/PAI';
const UA = { 'user-agent': 'pai-demo (+https://pai.ninabrekkerese.workers.dev)' };

const SCHEMA = `
CREATE TABLE IF NOT EXISTS verifications (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, sha256 TEXT NOT NULL, file_name TEXT, size_bytes INTEGER, match INTEGER NOT NULL, asset TEXT, source TEXT, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS verifications_user ON verifications (user_id, created_at);
CREATE TABLE IF NOT EXISTS watch (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, address TEXT NOT NULL, label TEXT, created_at INTEGER NOT NULL, UNIQUE (user_id, address));
CREATE TABLE IF NOT EXISTS loadouts (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, name TEXT NOT NULL, ram_gb INTEGER NOT NULL, models TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS loadouts_user ON loadouts (user_id);
CREATE TABLE IF NOT EXISTS hardware (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, device TEXT NOT NULL, arch TEXT NOT NULL, cpu TEXT, ram_gb INTEGER, boot TEXT NOT NULL, result TEXT NOT NULL, notes TEXT, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS hardware_created ON hardware (created_at);
CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL)
`;

type Env = KitEnv;

/* ---------------------------------------------------------------- caching */

/** Edge cache first, then the live loader; the last good value is kept in D1 so an upstream outage still serves data. */
async function cached<T>(env: Env, ctx: ExecutionContext, key: string, ttl: number, load: () => Promise<T>): Promise<T & { stale?: boolean }> {
  const cache = caches.default;
  const req = new Request(`https://cache.internal/${encodeURIComponent(key)}`);
  const hit = await cache.match(req);
  if (hit) return hit.json();
  try {
    const value = await load();
    const body = JSON.stringify(value);
    ctx.waitUntil(
      Promise.all([
        cache.put(req, new Response(body, { headers: { 'cache-control': `max-age=${ttl}`, 'content-type': 'application/json' } })),
        env.DB.prepare('INSERT INTO cache (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at')
          .bind(key, body, Date.now())
          .run(),
      ]),
    );
    return value as T & { stale?: boolean };
  } catch (error) {
    const row = await env.DB.prepare('SELECT value FROM cache WHERE key = ?').bind(key).first<{ value: string }>();
    if (row) return { ...(JSON.parse(row.value) as T), stale: true };
    throw new HttpError(502, `Upstream unavailable: ${(error as Error).message}`);
  }
}

async function getJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(url, { ...init, headers: { accept: 'application/json', ...UA, ...init.headers } });
  if (!r.ok) throw new Error(`${new URL(url).host} returned ${r.status}`);
  return r.json() as Promise<T>;
}

async function getText(url: string): Promise<string> {
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(`${new URL(url).host} returned ${r.status}`);
  return r.text();
}

/* ---------------------------------------------------------------- release */

interface Checksum {
  arch: 'amd64' | 'arm64';
  file: string;
  sha256: string;
  source: 'release' | 'SHA256SUMS';
  url: string;
}

interface Release {
  checksums: Checksum[];
  name: string;
  notesUrl: string;
  publishedAt: string;
  tag: string;
}

const archOf = (file: string): Checksum['arch'] => (file.includes('arm64') ? 'arm64' : 'amd64');

function parseSums(text: string, source: Checksum['source'], url: string): Checksum[] {
  return text
    .split('\n')
    .map((l) => l.trim().match(/^([a-f0-9]{64})\s+\*?(.+)$/i))
    .filter((m): m is RegExpMatchArray => !!m)
    .map((m) => ({ arch: archOf(m[2]), file: m[2], sha256: m[1].toLowerCase(), source, url }));
}

interface ReleaseMeta {
  name: string;
  notesUrl: string;
  publishedAt: string;
  sumUrls: string[];
  tag: string;
}

async function releaseFromApi(): Promise<ReleaseMeta> {
  const rel = await getJson<{
    assets: { browser_download_url: string; name: string }[];
    html_url: string;
    name: string | null;
    published_at: string;
    tag_name: string;
  }>(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { accept: 'application/vnd.github+json' } });
  return {
    name: rel.name || rel.tag_name,
    notesUrl: rel.html_url,
    publishedAt: rel.published_at,
    sumUrls: rel.assets.filter((a) => a.name.endsWith('.sha256')).map((a) => a.browser_download_url),
    tag: rel.tag_name,
  };
}

/** The REST API rate-limits shared Cloudflare egress IPs, so fall back to the public release pages and Atom feed. */
async function releaseFromPages(): Promise<ReleaseMeta> {
  const latest = await fetch(`https://github.com/${REPO}/releases/latest`, { headers: UA, redirect: 'manual' });
  const tag = latest.headers.get('location')?.match(/\/releases\/tag\/([^/?#]+)/)?.[1];
  if (!tag) throw new Error(`github.com returned ${latest.status} without a release tag`);
  const [assets, atom] = await Promise.all([getText(`https://github.com/${REPO}/releases/expanded_assets/${tag}`), getText(`https://github.com/${REPO}/releases.atom`)]);
  const entry = atom.split('<entry>').find((e) => e.includes(`/releases/tag/${tag}"`)) ?? '';
  const sumUrls = [...new Set([...assets.matchAll(/href="(\/[^"]+\/releases\/download\/[^"]+\.sha256)"/g)].map((m) => `https://github.com${m[1]}`))];
  return {
    name: entry.match(/<title>([^<]+)<\/title>/)?.[1] ?? tag,
    notesUrl: `https://github.com/${REPO}/releases/tag/${tag}`,
    publishedAt: entry.match(/<updated>([^<]+)<\/updated>/)?.[1] ?? new Date().toISOString(),
    sumUrls,
    tag,
  };
}

async function loadRelease(): Promise<Release> {
  const meta = await releaseFromApi().catch(releaseFromPages);
  const fromRelease = (await Promise.all(meta.sumUrls.map(async (u) => parseSums(await getText(u), 'release', u)))).flat();
  const sumsUrl = `https://raw.githubusercontent.com/${REPO}/${meta.tag}/SHA256SUMS`;
  const fromRepo = await getText(sumsUrl)
    .then((t) => parseSums(t, 'SHA256SUMS', sumsUrl))
    .catch(() => [] as Checksum[]);
  return { checksums: [...fromRelease, ...fromRepo], name: meta.name, notesUrl: meta.notesUrl, publishedAt: meta.publishedAt, tag: meta.tag };
}

const release = (env: Env, ctx: ExecutionContext) => cached(env, ctx, 'release:latest', 600, loadRelease);

/* ----------------------------------------------------------------- market */

interface Market {
  btc: { fees: Record<string, number>; height: number; usd: number; change24h: number };
  fetchedAt: number;
  xmr: { difficulty: number; feePerKb: number; hashRate: number; height: number; usd: number; change24h: number };
}

type XmrChain = Pick<Market['xmr'], 'difficulty' | 'feePerKb' | 'hashRate' | 'height'>;

const XMR_NODES = ['https://node.sethforprivacy.com', 'https://xmr-node.cakewallet.com:18081', 'https://monero.stackwallet.com:18081'];
const XMR_BLOCK_SECONDS = 120;

async function xmrRpc<T>(node: string, method: string): Promise<T> {
  const r = await getJson<{ error?: { message: string }; result?: T }>(`${node}/json_rpc`, {
    body: JSON.stringify({ id: '0', jsonrpc: '2.0', method }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });
  if (!r.result) throw new Error(`${new URL(node).host}: ${r.error?.message ?? 'empty result'}`);
  return r.result;
}

async function xmrFromNode(node: string): Promise<XmrChain> {
  const [info, fee] = await Promise.all([
    xmrRpc<{ difficulty: number; height: number; synchronized: boolean }>(node, 'get_info'),
    xmrRpc<{ fee: number }>(node, 'get_fee_estimate'),
  ]);
  if (!info.synchronized) throw new Error(`${new URL(node).host} is not synchronized`);
  return { difficulty: info.difficulty, feePerKb: fee.fee * 1024, hashRate: info.difficulty / XMR_BLOCK_SECONDS, height: info.height };
}

async function xmrFromExplorer(): Promise<XmrChain> {
  const { data } = await getJson<{ data: { difficulty: number | string; fee_per_kb: number; hash_rate: number; height: number } }>('https://xmrchain.net/api/networkinfo');
  return { difficulty: Number(data.difficulty), feePerKb: data.fee_per_kb, hashRate: data.hash_rate, height: data.height };
}

/** First Monero source that answers: the block explorer, then public daemon RPC nodes in order. */
async function xmrChain(): Promise<XmrChain> {
  const errors: string[] = [];
  for (const load of [xmrFromExplorer, ...XMR_NODES.map((n) => () => xmrFromNode(n))]) {
    try {
      return await load();
    } catch (error) {
      errors.push((error as Error).message);
    }
  }
  throw new Error(`Monero sources failed: ${errors.join('; ')}`);
}

async function loadMarket(): Promise<Market> {
  const [ticker, fees, height, xmr] = await Promise.all([
    getJson<{ error: string[]; result: Record<string, { c: [string]; o: string }> }>('https://api.kraken.com/0/public/Ticker?pair=XBTUSD,XMRUSD'),
    getJson<Record<string, number>>('https://mempool.space/api/v1/fees/recommended'),
    getText('https://mempool.space/api/blocks/tip/height'),
    xmrChain(),
  ]);
  if (ticker.error.length) throw new Error(`Kraken: ${ticker.error.join(', ')}`);
  const pick = (re: RegExp) => {
    const k = Object.keys(ticker.result).find((x) => re.test(x));
    if (!k) throw new Error('Kraken pair missing');
    const last = Number(ticker.result[k].c[0]);
    const open = Number(ticker.result[k].o);
    return { change24h: open ? ((last - open) / open) * 100 : 0, usd: last };
  };
  return { btc: { ...pick(/XBT/), fees, height: Number(height) }, fetchedAt: Date.now(), xmr: { ...pick(/XMR/), ...xmr } };
}

/* ------------------------------------------------------------- bitcoin */

const BTC_ADDR = /^(bc1[02-9ac-hj-np-z]{11,87}|[13][1-9A-HJ-NP-Za-km-z]{25,34})$/;

function btcAddress(v: unknown): string {
  const a = str(v, 'address', 100);
  if (!BTC_ADDR.test(a)) throw new HttpError(400, 'Not a valid Bitcoin mainnet address (bc1…, 1… or 3…)');
  return a;
}

interface Stats {
  funded_txo_sum: number;
  spent_txo_sum: number;
  tx_count: number;
}

async function btcSummary(address: string) {
  const [info, txs] = await Promise.all([
    getJson<{ chain_stats: Stats; mempool_stats: Stats }>(`https://mempool.space/api/address/${address}`),
    getJson<{ fee: number; status: { block_height?: number; block_time?: number; confirmed: boolean }; txid: string; vin: { prevout?: { scriptpubkey_address?: string; value: number } }[]; vout: { scriptpubkey_address?: string; value: number }[] }[]>(
      `https://mempool.space/api/address/${address}/txs`,
    ),
  ]);
  const bal = (s: Stats) => s.funded_txo_sum - s.spent_txo_sum;
  return {
    address,
    confirmedSats: bal(info.chain_stats),
    pendingSats: bal(info.mempool_stats),
    recent: txs.slice(0, 10).map((t) => {
      const out = t.vout.filter((o) => o.scriptpubkey_address === address).reduce((s, o) => s + o.value, 0);
      const inn = t.vin.filter((i) => i.prevout?.scriptpubkey_address === address).reduce((s, i) => s + (i.prevout?.value ?? 0), 0);
      return { confirmed: t.status.confirmed, deltaSats: out - inn, feeSats: t.fee, height: t.status.block_height ?? null, time: t.status.block_time ?? null, txid: t.txid };
    }),
    txCount: info.chain_stats.tx_count + info.mempool_stats.tx_count,
  };
}

/* --------------------------------------------------------------- models */

const MODEL_REF = /^[a-z0-9][a-z0-9._-]{0,63}(\/[a-z0-9][a-z0-9._-]{0,63})?(:[a-zA-Z0-9._-]{1,128})?$/;

interface ModelInfo {
  diskBytes: number;
  family: string | null;
  layers: number;
  params: string | null;
  quant: string | null;
  /** Rough resident memory: weights + ~20% for KV cache/context + 0.5 GB runtime overhead. */
  ramGb: number;
  ref: string;
}

async function loadModel(ref: string): Promise<ModelInfo> {
  const [repo, tag = 'latest'] = ref.split(':');
  const path = repo.includes('/') ? repo : `library/${repo}`;
  const r = await fetch(`https://registry.ollama.ai/v2/${path}/manifests/${tag}`, {
    headers: { accept: 'application/vnd.docker.distribution.manifest.v2+json', ...UA },
  });
  if (r.status === 404) throw new HttpError(404, `Model "${ref}" not found in the Ollama library`);
  if (!r.ok) throw new HttpError(502, `Ollama registry returned ${r.status}`);
  const m = (await r.json()) as { config?: { digest: string }; layers: { mediaType: string; size: number }[] };
  const diskBytes = m.layers.reduce((s, l) => s + l.size, 0);
  const weights = m.layers.filter((l) => l.mediaType.endsWith('.model')).reduce((s, l) => s + l.size, 0) || diskBytes;
  let cfg: { file_type?: string; model_family?: string; model_type?: string } = {};
  if (m.config) {
    const c = await fetch(`https://registry.ollama.ai/v2/${path}/blobs/${m.config.digest}`, { headers: UA });
    if (c.ok) cfg = await c.json();
  }
  return {
    diskBytes,
    family: cfg.model_family ?? null,
    layers: m.layers.length,
    params: cfg.model_type ?? null,
    quant: cfg.file_type ?? null,
    ramGb: Math.round(((weights * 1.2) / 2 ** 30 + 0.5) * 10) / 10,
    ref: `${repo}:${tag}`,
  };
}

function modelRef(v: unknown): string {
  const ref = str(v, 'model', 200).toLowerCase();
  if (!MODEL_REF.test(ref)) throw new HttpError(400, `"${ref}" is not a valid model reference (e.g. llama3.2:3b)`);
  return ref;
}

const model = (env: Env, ctx: ExecutionContext, ref: string) => cached(env, ctx, `model:${ref}`, 3600, () => loadModel(ref));

/* ------------------------------------------------------------- validation */

const HARDWARE_RESULTS = ['works', 'partial', 'fails'] as const;
const ARCHES = ['amd64', 'arm64'] as const;
const BOOTS = ['uefi', 'legacy', 'apple', 'other'] as const;

function oneOf<T extends string>(v: unknown, field: string, allowed: readonly T[]): T {
  if (typeof v !== 'string' || !(allowed as readonly string[]).includes(v)) throw new HttpError(400, `${field} must be one of: ${allowed.join(', ')}`);
  return v as T;
}

function optStr(v: unknown, field: string, max: number): string | null {
  if (v == null || v === '') return null;
  return str(v, field, max);
}

function intIn(v: unknown, field: string, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new HttpError(400, `${field} must be a whole number between ${min} and ${max}`);
  return n;
}

const sh = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

function pullScript(name: string, models: string[]) {
  return ['#!/usr/bin/env bash', `# PAI loadout: ${name.replace(/\n/g, ' ')}`, 'set -euo pipefail', ...models.map((m) => `ollama pull ${sh(m)}`), ''].join('\n');
}

async function recordVerification(env: Env, ctx: ExecutionContext, user: User, body: { fileName?: unknown; sha256?: unknown; size?: unknown }) {
  const sha = str(body.sha256, 'sha256', 80).toLowerCase().replace(/\s+/g, '');
  if (!/^[a-f0-9]{64}$/.test(sha)) throw new HttpError(400, 'sha256 must be 64 hex characters');
  const fileName = optStr(body.fileName, 'fileName', 200);
  const size = body.size == null ? null : intIn(body.size, 'size', 0, Number.MAX_SAFE_INTEGER);
  return metered(env, ctx, user, 'verify', { file: fileName, sha256: sha.slice(0, 12) }, async () => {
    const rel = await release(env, ctx);
    const hit = rel.checksums.find((c) => c.sha256 === sha) ?? null;
    await env.DB.prepare('INSERT INTO verifications (user_id, sha256, file_name, size_bytes, match, asset, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(user.id, sha, fileName, size, hit ? 1 : 0, hit?.file ?? null, hit?.source ?? null, Date.now())
      .run();
    return { match: hit, release: rel.tag, sha256: sha, stale: rel.stale ?? false };
  });
}

/* ----------------------------------------------------------------- routes */

const router = kitRoutes(new Router<Env>(), { appName: 'PAI Cloud', keySlug: 'pai' })
  .get('/api/v1/release', async (_req, env, ctx) => json(await release(env, ctx)))
  .get('/api/v1/market', async (_req, env, ctx) => json(await cached(env, ctx, 'market', 60, loadMarket)))

  .post('/api/v1/verify', async (req, env, ctx) => {
    const user = await requireKeyOrUser(req, env, ctx);
    return json(await recordVerification(env, ctx, user, await readJson(req)));
  })
  .get('/api/v1/verifications', async (req, env, ctx) => {
    const user = await requireKeyOrUser(req, env, ctx);
    const { results } = await env.DB.prepare('SELECT id, sha256, file_name, size_bytes, match, asset, source, created_at FROM verifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50')
      .bind(user.id)
      .all();
    return json({ verifications: results });
  })

  .get('/api/v1/btc/address/:addr', async (req, env, ctx, p) => {
    const user = await requireKeyOrUser(req, env, ctx);
    const address = btcAddress(p.addr);
    return json(await metered(env, ctx, user, 'btc.address', { address }, () => btcSummary(address)));
  })
  .get('/api/v1/watch', async (req, env, ctx) => {
    const user = await requireKeyOrUser(req, env, ctx);
    const { results } = await env.DB.prepare('SELECT id, address, label, created_at FROM watch WHERE user_id = ? ORDER BY created_at').bind(user.id).all<{ address: string; created_at: number; id: number; label: string | null }>();
    const summaries = await Promise.all(
      results.map(async (w) => {
        try {
          const s = await btcSummary(w.address);
          return { ...w, confirmedSats: s.confirmedSats, error: null, pendingSats: s.pendingSats, txCount: s.txCount };
        } catch (error) {
          return { ...w, confirmedSats: null, error: (error as Error).message, pendingSats: null, txCount: null };
        }
      }),
    );
    return json({ watch: summaries });
  })
  .post('/api/v1/watch', async (req, env, ctx) => {
    const user = await requireKeyOrUser(req, env, ctx);
    const b = await readJson<{ address?: unknown; label?: unknown }>(req);
    const address = btcAddress(b.address);
    const label = optStr(b.label, 'label', 60);
    const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM watch WHERE user_id = ?').bind(user.id).first<{ n: number }>();
    if ((count?.n ?? 0) >= 20) throw new HttpError(409, 'Watchlist is full (20 addresses). Remove one first.');
    const row = await env.DB.prepare('INSERT INTO watch (user_id, address, label, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, address) DO UPDATE SET label = excluded.label RETURNING id')
      .bind(user.id, address, label, Date.now())
      .first<{ id: number }>();
    return json({ id: row!.id }, { status: 201 });
  })
  .delete('/api/v1/watch/:id', async (req, env, ctx, p) => {
    const user = await requireKeyOrUser(req, env, ctx);
    const r = await env.DB.prepare('DELETE FROM watch WHERE id = ? AND user_id = ?').bind(Number(p.id), user.id).run();
    if (!r.meta.changes) throw new HttpError(404, 'Not found');
    return json({ ok: true });
  })

  .get('/api/v1/models/:ref', async (_req, env, ctx, p) => json(await model(env, ctx, modelRef(p.ref))))
  .get('/api/v1/loadouts', async (req, env, ctx) => {
    const user = await requireKeyOrUser(req, env, ctx);
    const { results } = await env.DB.prepare('SELECT id, name, ram_gb, models, created_at FROM loadouts WHERE user_id = ? ORDER BY created_at DESC').bind(user.id).all<{ models: string; name: string }>();
    return json({ loadouts: results.map((l) => ({ ...l, models: JSON.parse(l.models) as string[], script: pullScript(l.name, JSON.parse(l.models)) })) });
  })
  .post('/api/v1/loadouts', async (req, env, ctx) => {
    const user = await requireKeyOrUser(req, env, ctx);
    const b = await readJson<{ models?: unknown; name?: unknown; ramGb?: unknown }>(req);
    const name = str(b.name, 'name', 60);
    const ramGb = intIn(b.ramGb, 'ramGb', 1, 1024);
    if (!Array.isArray(b.models) || !b.models.length || b.models.length > 12) throw new HttpError(400, 'models must list 1–12 model references');
    const models = [...new Set(b.models.map(modelRef))];
    const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM loadouts WHERE user_id = ?').bind(user.id).first<{ n: number }>();
    if ((n?.n ?? 0) >= 25) throw new HttpError(409, 'You have 25 loadouts. Delete one first.');
    const infos = await metered(env, ctx, user, 'loadout.create', { models, name }, () => Promise.all(models.map((m) => model(env, ctx, m))));
    const need = Math.max(...infos.map((i) => i.ramGb));
    const disk = infos.reduce((s, i) => s + i.diskBytes, 0);
    const row = await env.DB.prepare('INSERT INTO loadouts (user_id, name, ram_gb, models, created_at) VALUES (?, ?, ?, ?, ?) RETURNING id')
      .bind(user.id, name, ramGb, JSON.stringify(infos.map((i) => i.ref)), Date.now())
      .first<{ id: number }>();
    return json({ diskBytes: disk, fits: need <= ramGb, id: row!.id, largestRamGb: need, script: pullScript(name, infos.map((i) => i.ref)) }, { status: 201 });
  })
  .delete('/api/v1/loadouts/:id', async (req, env, ctx, p) => {
    const user = await requireKeyOrUser(req, env, ctx);
    const r = await env.DB.prepare('DELETE FROM loadouts WHERE id = ? AND user_id = ?').bind(Number(p.id), user.id).run();
    if (!r.meta.changes) throw new HttpError(404, 'Not found');
    return json({ ok: true });
  })

  .get('/api/v1/hardware', async (req, env) => {
    const u = new URL(req.url);
    const arch = u.searchParams.get('arch');
    const q = arch && (ARCHES as readonly string[]).includes(arch) ? env.DB.prepare('SELECT * FROM hardware WHERE arch = ? ORDER BY created_at DESC LIMIT 100').bind(arch) : env.DB.prepare('SELECT * FROM hardware ORDER BY created_at DESC LIMIT 100');
    const [rows, totals] = await env.DB.batch([q, env.DB.prepare('SELECT result, COUNT(*) AS n FROM hardware GROUP BY result')]);
    const me = await (async () => {
      try {
        return (await requireUser(req, env)).id;
      } catch {
        return null;
      }
    })();
    return json({
      reports: (rows.results as (Record<string, unknown> & { user_id: string })[]).map(({ user_id, ...r }) => ({ ...r, mine: user_id === me })),
      totals: Object.fromEntries((totals.results as { n: number; result: string }[]).map((t) => [t.result, t.n])),
    });
  })
  .post('/api/v1/hardware', async (req, env, ctx) => {
    const user = await requireKeyOrUser(req, env, ctx);
    const b = await readJson<Record<string, unknown>>(req);
    const row = {
      arch: oneOf(b.arch, 'arch', ARCHES),
      boot: oneOf(b.boot, 'boot', BOOTS),
      cpu: optStr(b.cpu, 'cpu', 80),
      device: str(b.device, 'device', 80),
      notes: optStr(b.notes, 'notes', 500),
      ram_gb: b.ramGb == null || b.ramGb === '' ? null : intIn(b.ramGb, 'ramGb', 1, 1024),
      result: oneOf(b.result, 'result', HARDWARE_RESULTS),
    };
    const recent = await env.DB.prepare('SELECT COUNT(*) AS n FROM hardware WHERE user_id = ? AND created_at > ?').bind(user.id, Date.now() - 86_400_000).first<{ n: number }>();
    if ((recent?.n ?? 0) >= 10) throw new HttpError(429, 'Limit is 10 hardware reports per day');
    const r = await metered(env, ctx, user, 'hardware.report', { device: row.device, result: row.result }, () =>
      env.DB.prepare('INSERT INTO hardware (user_id, device, arch, cpu, ram_gb, boot, result, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id')
        .bind(user.id, row.device, row.arch, row.cpu, row.ram_gb, row.boot, row.result, row.notes, Date.now())
        .first<{ id: number }>(),
    );
    return json({ id: r!.id }, { status: 201 });
  })
  .delete('/api/v1/hardware/:id', async (req, env, ctx, p) => {
    const user = await requireKeyOrUser(req, env, ctx);
    const r = await env.DB.prepare('DELETE FROM hardware WHERE id = ? AND user_id = ?').bind(Number(p.id), user.id).run();
    if (!r.meta.changes) throw new HttpError(404, 'Not found');
    return json({ ok: true });
  })

  .get('/api/v1/overview', async (req, env, ctx) => {
    const user = await requireKeyOrUser(req, env, ctx);
    const [v, w, l, hw] = await env.DB.batch([
      env.DB.prepare('SELECT COUNT(*) AS n, SUM(match) AS ok FROM verifications WHERE user_id = ?').bind(user.id),
      env.DB.prepare('SELECT COUNT(*) AS n FROM watch WHERE user_id = ?').bind(user.id),
      env.DB.prepare('SELECT COUNT(*) AS n FROM loadouts WHERE user_id = ?').bind(user.id),
      env.DB.prepare('SELECT COUNT(*) AS n FROM hardware WHERE user_id = ?').bind(user.id),
    ]);
    const first = (r: D1Result) => (r.results[0] ?? {}) as { n?: number; ok?: number };
    return json({ hardware: first(hw).n ?? 0, loadouts: first(l).n ?? 0, verified: first(v).ok ?? 0, verifications: first(v).n ?? 0, watch: first(w).n ?? 0 });
  });

export default { fetch: serve(router, SCHEMA) } satisfies ExportedHandler<Env>;
