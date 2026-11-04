import { $, ago, api, busy, confirmDialog, copy, fmt, gate, h, mountAuth, mountKeys, mountUsage, short, tabs, toast, usd, user } from '/kit/kit.js';

mountAuth({ appHref: '/platform/app/' });

const btc = (sats) => (sats == null ? '—' : `${(sats / 1e8).toLocaleString(undefined, { maximumFractionDigits: 8, minimumFractionDigits: 8 })} BTC`);
const gb = (bytes) => `${fmt(bytes / 1e9, 2)} GB`;
const skel = (rows = 3) => h('div', { class: 'stack' }, Array.from({ length: rows }, () => h('div', { class: 'skeleton sk-row' })));
const empty = (text) => h('p', { class: 'empty-inline muted' }, text);
const tile = (label, value, extra) => h('div', { class: 'card kpi' }, h('div', { class: 'l' }, label), h('div', { class: 'v' }, value), extra ? h('div', { class: 'muted' }, extra) : null);
const table = (head, rows) => h('div', { class: 'table-wrap' }, h('table', { class: 'table' }, h('thead', {}, h('tr', {}, head.map((c) => h('th', {}, c)))), h('tbody', {}, rows)));
const formData = (form) => Object.fromEntries([...new FormData(form)].map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]));

/** Renders `load()` into `el` with skeleton, error-with-retry and populated states. */
async function section(el, load, render, { quiet = false } = {}) {
  if (!quiet || !el.children.length) el.replaceChildren(skel());
  try {
    el.replaceChildren(...[render(await load())].flat());
  } catch (e) {
    el.replaceChildren(h('div', { class: 'empty-inline' }, h('p', { class: 'kit-err' }, e.message), h('button', { class: 'btn btn-sm', onclick: () => section(el, load, render), type: 'button' }, 'Retry')));
  }
}

const removeButton = (label, text, path, after) =>
  h('button', {
    'aria-label': label,
    class: 'btn btn-sm btn-ghost',
    onclick: async (ev) => {
      if (!(await confirmDialog(text, 'Delete'))) return;
      await busy(ev.currentTarget, async () => {
        await api(path, { method: 'DELETE' });
        toast('Deleted', 'success');
        after();
      });
    },
    type: 'button',
  }, 'Delete');

/* ---------------------------------------------------------------- overview */

const loadKpis = () =>
  section($('#kpis'), () => api('/api/v1/overview'), (o) => [
    tile('ISO checks', fmt(o.verifications, 0), `${fmt(o.verified, 0)} matched a release`),
    tile('Watched addresses', fmt(o.watch, 0), 'of 20'),
    tile('Model loadouts', fmt(o.loadouts, 0), 'of 25'),
    tile('Hardware reports', fmt(o.hardware, 0), 'shared publicly'),
  ]);

const delta = (pct) => h('span', { class: `delta ${pct >= 0 ? 'up' : 'down'}` }, `${pct >= 0 ? '▲' : '▼'} ${fmt(Math.abs(pct), 2)}% 24h`);
const loadMarket = (quiet) =>
  section(
    $('#market'),
    () => api('/api/v1/market'),
    (m) => [
      tile('BTC / USD', usd(m.btc.usd), delta(m.btc.change24h)),
      tile('XMR / USD', usd(m.xmr.usd), delta(m.xmr.change24h)),
      tile('BTC fees (sat/vB)', `${fmt(m.btc.fees.fastestFee, 0)} · ${fmt(m.btc.fees.halfHourFee, 0)} · ${fmt(m.btc.fees.hourFee, 0)}`, 'next block · 30 min · 1 h'),
      tile('BTC height', fmt(m.btc.height, 0), `economy fee ${fmt(m.btc.fees.economyFee, 0)} sat/vB`),
      tile('XMR height', fmt(m.xmr.height, 0), `${fmt(m.xmr.hashRate / 1e9, 2)} GH/s`),
      tile('XMR fee', `${fmt(m.xmr.feePerKb / 1e12, 8)} XMR/kB`, `difficulty ${fmt(m.xmr.difficulty / 1e9, 1)} G`),
      h('p', { class: 'muted ticker-note' }, m.stale ? `Upstream unavailable; last data from ${ago(m.fetchedAt)}.` : `Updated ${ago(m.fetchedAt)}`),
    ],
    { quiet },
  );

/* ------------------------------------------------------------------ verify */

let release = null;
const loadChecksums = () =>
  section($('#checksums'), () => api('/api/v1/release'), (r) => {
    release = r;
    return [
      h('p', { class: 'muted' }, `${r.name || r.tag}, published ${new Date(r.publishedAt).toLocaleDateString()}. `, h('a', { href: r.notesUrl, rel: 'noopener' }, 'Release notes')),
      table(['Arch', 'File', 'SHA-256', 'Source', ''], r.checksums.map((c) => h('tr', {}, h('td', {}, c.arch), h('td', { class: 'nowrap' }, h('a', { href: c.url, rel: 'noopener' }, c.file)), h('td', { class: 'hash' }, c.sha256), h('td', {}, c.source === 'release' ? 'Release asset' : 'SHA256SUMS'), h('td', {}, h('button', { class: 'btn btn-sm btn-ghost', onclick: () => copy(c.sha256), type: 'button' }, 'Copy'))))),
    ];
  });

const loadHistory = () =>
  section($('#history'), () => api('/api/v1/verifications'), ({ verifications }) =>
    verifications.length
      ? table(['When', 'File', 'SHA-256', 'Result'], verifications.map((v) => h('tr', {}, h('td', { class: 'nowrap' }, ago(v.created_at)), h('td', { class: 'trunc' }, v.file_name ?? '—', v.size_bytes ? h('span', { class: 'muted' }, ` · ${gb(v.size_bytes)}`) : null), h('td', { class: 'hash', title: v.sha256 }, short(v.sha256, 10)), h('td', {}, v.match ? h('span', { class: 'badge ok' }, `Matches ${v.asset}`) : h('span', { class: 'badge bad' }, 'No match')))))
      : empty('No verifications yet. Hash a download or paste a checksum above.'),
  );

async function submitHash(body) {
  const r = await api('/api/v1/verify', { body });
  const out = $('#verify-result');
  out.replaceChildren(
    r.match
      ? h('div', { class: 'callout ok' }, h('h3', {}, '✓ Genuine PAI build'), h('p', {}, `This hash matches ${r.match.file} (${r.match.arch}) in ${r.release}, from the ${r.match.source === 'release' ? 'release asset checksum' : 'repository SHA256SUMS'}. It is safe to flash.`), h('p', { class: 'hash' }, r.sha256))
      : h('div', { class: 'callout bad' }, h('h3', {}, '✗ No match'), h('p', {}, `This hash does not match any published checksum for ${r.release}. Do not flash this file: download it again from the official release, or check you hashed the right file.`), h('p', { class: 'hash' }, r.sha256)),
  );
  if (r.stale) out.append(h('p', { class: 'muted' }, 'GitHub was unreachable, so the check used the last saved release data.'));
  out.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  loadHistory();
  loadKpis();
}

const CHUNK = 8 * 1024 * 1024;
let hashing = null;

function hashFile(file) {
  if (hashing) return toast('A file is already being hashed', 'warn');
  const worker = new Worker('/sha256-worker.js');
  const ui = { bar: $('#hash-bar'), box: $('#hash-progress'), name: $('#hash-name'), pct: $('#hash-pct') };
  ui.box.hidden = false;
  ui.name.textContent = `${file.name} · ${gb(file.size)}`;
  ui.bar.style.width = '0%';
  ui.pct.textContent = 'Starting…';
  const started = performance.now();
  let pending = null;
  const next = () => new Promise((resolve, reject) => (pending = { reject, resolve }));
  worker.onmessage = ({ data }) => (data.type === 'error' ? pending?.reject(new Error(data.message)) : pending?.resolve(data));
  worker.onerror = (e) => pending?.reject(new Error(e.message || 'Hash worker failed'));
  hashing = { cancel: () => pending?.reject(new Error('cancelled')) };

  (async () => {
    try {
      worker.postMessage({ type: 'init' });
      await next();
      for (let off = 0; off < file.size; off += CHUNK) {
        const buf = await file.slice(off, off + CHUNK).arrayBuffer();
        worker.postMessage({ data: buf, type: 'update' }, [buf]);
        const { bytes } = await next();
        const done = Math.min(bytes ?? off + buf.byteLength, file.size);
        const secs = (performance.now() - started) / 1000;
        const rate = done / secs;
        ui.bar.style.width = `${((done / file.size) * 100).toFixed(1)}%`;
        ui.pct.textContent = `${((done / file.size) * 100).toFixed(1)}% · ${fmt(rate / 1e6, 0)} MB/s · ${fmt((file.size - done) / rate, 0)}s left`;
      }
      worker.postMessage({ type: 'digest' });
      const { hex } = await next();
      ui.pct.textContent = 'Checking…';
      await submitHash({ fileName: file.name, sha256: hex, size: file.size });
      ui.box.hidden = true;
    } catch (e) {
      ui.box.hidden = true;
      if (e.message !== 'cancelled') toast(`Hashing failed: ${e.message}`, 'error');
    } finally {
      worker.terminate();
      hashing = null;
      $('#file').value = '';
    }
  })();
}

function wireVerify() {
  const drop = $('#drop');
  const input = $('#file');
  drop.addEventListener('click', () => input.click());
  drop.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), input.click()));
  drop.addEventListener('dragover', (e) => (e.preventDefault(), drop.classList.add('over')));
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('over');
    const f = e.dataTransfer?.files?.[0];
    if (f) hashFile(f);
  });
  input.addEventListener('change', () => input.files[0] && hashFile(input.files[0]));
  $('#hash-cancel').addEventListener('click', () => hashing?.cancel());
  $('#paste-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const d = formData(e.currentTarget);
    busy(e.submitter, () => submitHash({ fileName: d.fileName || undefined, sha256: d.sha256 }));
  });
}

/* ----------------------------------------------------------------- bitcoin */

const mempoolTx = (txid) => h('a', { class: 'hash', href: `https://mempool.space/tx/${txid}`, rel: 'noopener' }, short(txid, 8));

function renderLookup(s) {
  return [
    h('div', { class: 'ticker' }, tile('Confirmed', btc(s.confirmedSats)), tile('Pending', btc(s.pendingSats)), tile('Transactions', fmt(s.txCount, 0))),
    h('div', { class: 'row' }, h('a', { class: 'btn btn-sm', href: `https://mempool.space/address/${s.address}`, rel: 'noopener' }, 'Open in mempool.space'), h('button', { class: 'btn btn-sm', onclick: (ev) => busy(ev.currentTarget, () => addWatch(s.address, null)), type: 'button' }, 'Add to watchlist')),
    s.recent.length
      ? table(['Tx', 'Change', 'Fee', 'Status'], s.recent.map((t) => h('tr', {}, h('td', {}, mempoolTx(t.txid)), h('td', { class: `sats delta ${t.deltaSats >= 0 ? 'up' : 'down'}` }, `${t.deltaSats >= 0 ? '+' : ''}${btc(t.deltaSats)}`), h('td', { class: 'sats' }, `${fmt(t.feeSats, 0)} sat`), h('td', { class: 'nowrap' }, t.confirmed ? `Block ${fmt(t.height, 0)} · ${ago(t.time * 1000)}` : h('span', { class: 'badge warn' }, 'Unconfirmed')))))
      : empty('This address has no transactions.'),
  ];
}

async function addWatch(address, label) {
  await api('/api/v1/watch', { body: { address, label: label || undefined } });
  toast('Added to watchlist', 'success');
  loadWatch();
  loadKpis();
}

const loadWatch = () =>
  section($('#watch'), () => api('/api/v1/watch'), ({ watch }) => {
    $('#watch-count').textContent = `${watch.length} / 20`;
    if (!watch.length) return empty('No addresses yet. Add a bc1, 1 or 3 address to track its balance. Watch-only: no keys involved.');
    const total = watch.reduce((s, w) => s + (w.confirmedSats ?? 0), 0);
    return [
      h('p', { class: 'muted' }, `Total confirmed: `, h('strong', { class: 'sats' }, btc(total))),
      table(['Label', 'Address', 'Confirmed', 'Pending', 'Txs', ''], watch.map((w) => h('tr', {}, h('td', {}, w.label ?? h('span', { class: 'muted' }, '—')), h('td', { class: 'hash', title: w.address }, h('a', { href: `https://mempool.space/address/${w.address}`, rel: 'noopener' }, short(w.address, 8))), w.error ? h('td', { class: 'kit-err', colspan: '3' }, w.error) : [h('td', { class: 'sats' }, btc(w.confirmedSats)), h('td', { class: 'sats' }, w.pendingSats ? btc(w.pendingSats) : '—'), h('td', {}, fmt(w.txCount, 0))], h('td', { class: 'right' }, removeButton(`Remove ${w.address}`, `Stop watching ${short(w.address, 8)}?`, `/api/v1/watch/${w.id}`, () => (loadWatch(), loadKpis())))))),
    ];
  });

function wireWallets() {
  $('#lookup-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const { address } = formData(e.currentTarget);
    busy(e.submitter, () => section($('#lookup'), () => api(`/api/v1/btc/address/${encodeURIComponent(address)}`), renderLookup));
  });
  $('#watch-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const d = formData(form);
    busy(e.submitter, async () => {
      await addWatch(d.address, d.label);
      form.reset();
    });
  });
}

/* ------------------------------------------------------------------ models */

const picked = new Map();

function renderPicked() {
  $('#picked').replaceChildren(...[...picked.values()].map((m) => h('button', { 'aria-label': `Remove ${m.ref}`, class: 'chip', onclick: () => (picked.delete(m.ref), renderPicked()), type: 'button' }, `${m.ref} · ${gb(m.diskBytes)} ✕`)));
  $('#picked-empty').hidden = picked.size > 0;
  const ram = Number($('#loadout-form').elements.ramGb.value) || 0;
  const need = Math.max(0, ...[...picked.values()].map((m) => m.ramGb));
  const disk = [...picked.values()].reduce((s, m) => s + m.diskBytes, 0);
  if (picked.size) $('#picked').append(h('div', { class: `meter ${need > ram ? 'over' : ''}` }, h('span', { class: 'nowrap' }, `Largest model needs ${fmt(need, 1)} GB of ${ram} GB`), h('span', { class: 'bar' }, h('i', { style: `width:${Math.min(100, (need / Math.max(ram, 1)) * 100)}%` })), h('span', { class: 'nowrap muted' }, `${gb(disk)} on disk`)));
}

const renderModel = (m) =>
  h('div', { class: 'stack' },
    h('div', { class: 'ticker' }, tile('Download', gb(m.diskBytes)), tile('RAM needed', `${fmt(m.ramGb, 1)} GB`), tile('Parameters', m.params ?? '—'), tile('Quantization', m.quant ?? '—')),
    h('div', { class: 'row' }, h('span', { class: 'muted grow' }, `${m.ref} · family ${m.family ?? 'unknown'} · ${m.layers} layers`), h('button', {
      class: 'btn btn-primary btn-sm',
      disabled: picked.has(m.ref) || picked.size >= 12,
      onclick: (ev) => {
        picked.set(m.ref, m);
        ev.currentTarget.disabled = true;
        renderPicked();
      },
      type: 'button',
    }, picked.has(m.ref) ? 'In loadout' : 'Add to loadout')),
  );

const loadLoadouts = () =>
  section($('#loadouts'), () => api('/api/v1/loadouts'), ({ loadouts }) =>
    loadouts.length
      ? h('div', { class: 'grid' }, loadouts.map((l) => h('div', { class: 'card stack' }, h('div', { class: 'row' }, h('h3', { class: 'grow trunc' }, l.name), h('span', { class: 'chip' }, `${l.ram_gb} GB RAM`)), h('div', { class: 'chips' }, l.models.map((m) => h('span', { class: 'chip' }, m))), h('pre', { class: 'code' }, l.script), h('div', { class: 'row end' }, h('span', { class: 'muted grow' }, ago(l.created_at)), h('button', { class: 'btn btn-sm', onclick: () => copy(l.script, 'Script copied'), type: 'button' }, 'Copy script'), removeButton(`Delete ${l.name}`, `Delete loadout "${l.name}"?`, `/api/v1/loadouts/${l.id}`, () => (loadLoadouts(), loadKpis()))))))
      : h('div', { class: 'card' }, empty('No loadouts yet. A loadout is a list of models to pull before you take PAI offline.')),
  );

function wireModels() {
  $('#model-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const { ref } = formData(e.currentTarget);
    busy(e.submitter, () => section($('#model-info'), () => api(`/api/v1/models/${encodeURIComponent(ref.toLowerCase())}`), renderModel));
  });
  const form = $('#loadout-form');
  form.elements.ramGb.addEventListener('input', renderPicked);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!picked.size) return toast('Add at least one model first', 'warn');
    const d = formData(form);
    busy(e.submitter, async () => {
      const r = await api('/api/v1/loadouts', { body: { models: [...picked.keys()], name: d.name, ramGb: Number(d.ramGb) } });
      toast(r.fits ? `Saved. ${gb(r.diskBytes)} to download.` : `Saved, but the largest model needs ${fmt(r.largestRamGb, 1)} GB of RAM.`, r.fits ? 'success' : 'warn');
      picked.clear();
      form.reset();
      renderPicked();
      $('#model-info').replaceChildren();
      loadLoadouts();
      loadKpis();
    });
  });
}

/* ---------------------------------------------------------------- hardware */

const RESULT = { fails: ['bad', 'Fails'], partial: ['warn', 'Partial'], works: ['ok', 'Works'] };
const BOOT = { apple: 'Apple', legacy: 'Legacy BIOS', other: 'Other', uefi: 'UEFI' };

const loadHardware = () => {
  const arch = $('#hw-arch').value;
  return section($('#hw-list'), () => api(`/api/v1/hardware${arch ? `?arch=${arch}` : ''}`), ({ reports, totals }) => {
    $('#hw-totals').replaceChildren(...Object.entries(RESULT).map(([k, [cls, label]]) => h('span', { class: `badge ${cls}` }, `${label}: ${totals[k] ?? 0}`)));
    return reports.length
      ? table(['Device', 'Arch', 'Boot', 'Result', 'Notes', 'When', ''], reports.map((r) => h('tr', {}, h('td', {}, h('strong', {}, r.device), r.cpu || r.ram_gb ? h('div', { class: 'muted' }, [r.cpu, r.ram_gb ? `${r.ram_gb} GB` : null].filter(Boolean).join(' · ')) : null), h('td', {}, r.arch), h('td', { class: 'nowrap' }, BOOT[r.boot] ?? r.boot), h('td', {}, h('span', { class: `badge ${RESULT[r.result][0]}` }, RESULT[r.result][1])), h('td', { class: 'mono-wrap' }, r.notes ?? ''), h('td', { class: 'nowrap' }, ago(r.created_at)), h('td', { class: 'right' }, r.mine ? removeButton(`Delete report for ${r.device}`, `Delete your report for ${r.device}?`, `/api/v1/hardware/${r.id}`, () => (loadHardware(), loadKpis())) : null))))
      : empty(arch ? `No ${arch} reports yet.` : 'No reports yet. Be the first to share how PAI ran on your machine.');
  });
};

function wireHardware() {
  $('#hw-arch').addEventListener('change', loadHardware);
  $('#hw-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const d = formData(form);
    busy(e.submitter, async () => {
      await api('/api/v1/hardware', { body: { ...d, cpu: d.cpu || undefined, notes: d.notes || undefined, ramGb: d.ramGb ? Number(d.ramGb) : undefined } });
      toast('Report submitted. Thanks!', 'success');
      form.reset();
      loadHardware();
      loadKpis();
    });
  });
}

/* -------------------------------------------------------------------- boot */

const root = $('#app');
await gate(root, { text: 'Sign in with an Ethereum or Solana wallet to verify ISOs, watch Bitcoin addresses, save model loadouts and report hardware.', title: 'Sign in to PAI Cloud' });
const me = user();
$('#who').textContent = `${me.chain === 'sol' ? 'Solana' : 'Ethereum'} · ${short(me.address)}`;
tabs(root);
wireVerify();
wireWallets();
wireModels();
wireHardware();
renderPicked();
loadKpis();
loadMarket();
loadChecksums();
loadHistory();
loadWatch();
loadLoadouts();
loadHardware();
mountKeys($('#keys'), { endpointHint: `curl -s ${location.origin}/api/v1/overview -H "Authorization: Bearer $PAI_KEY"` });
const usage = mountUsage($('#usage'));
window.addEventListener('hashchange', () => location.hash === '#usage' && usage.reload());
setInterval(() => document.visibilityState === 'visible' && loadMarket(true), 60_000);
