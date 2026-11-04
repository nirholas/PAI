import { $, api, ago, fmt, h, mountAuth, usd } from '/kit/kit.js';

mountAuth({ appHref: '/platform/app/' });

const delta = (pct) => h('span', { class: `delta ${pct >= 0 ? 'up' : 'down'}` }, `${pct >= 0 ? '▲' : '▼'} ${fmt(Math.abs(pct), 2)}%`);
const tile = (label, value, extra) => h('div', { class: 'card kpi' }, h('div', { class: 'l' }, label), h('div', { class: 'v' }, value), extra ? h('div', { class: 'muted' }, extra) : null);
const skeletonTiles = (el, n) => el.replaceChildren(...Array.from({ length: n }, () => h('div', { class: 'card' }, h('div', { class: 'skeleton sk-sm' }), h('div', { class: 'skeleton sk-lg' }))));
const failed = (el, msg, retry) => el.replaceChildren(h('div', { class: 'card empty-inline' }, h('p', { class: 'kit-err' }, msg), h('button', { class: 'btn btn-sm', onclick: retry, type: 'button' }, 'Retry')));

async function loadMarket() {
  const el = $('#ticker');
  if (!el.children.length) skeletonTiles(el, 4);
  try {
    const m = await api('/api/v1/market');
    el.replaceChildren(
      tile('Bitcoin', usd(m.btc.usd), delta(m.btc.change24h)),
      tile('Monero', usd(m.xmr.usd), delta(m.xmr.change24h)),
      tile('BTC fee (next block)', `${fmt(m.btc.fees.fastestFee, 0)} sat/vB`, `Block ${fmt(m.btc.height, 0)}`),
      tile('XMR network', `${fmt(m.xmr.hashRate / 1e9, 2)} GH/s`, `Block ${fmt(m.xmr.height, 0)}`),
    );
    el.append(h('p', { class: 'muted ticker-note' }, m.stale ? `Upstream unavailable; showing data from ${ago(m.fetchedAt)}.` : `Updated ${ago(m.fetchedAt)} · Kraken, mempool.space, xmrchain.net`));
  } catch (e) {
    failed(el, `Market data unavailable: ${e.message}`, loadMarket);
  }
}

async function loadRelease() {
  const el = $('#release-card');
  el.replaceChildren(h('div', { class: 'skeleton sk-sm' }), h('div', { class: 'skeleton sk-lg' }));
  try {
    const r = await api('/api/v1/release');
    $('#hero-ver').textContent = r.tag.replace(/^v/, '');
    el.replaceChildren(
      h('div', { class: 'row' }, h('h3', { class: 'grow' }, `Latest release: ${r.name || r.tag}`), h('span', { class: 'badge ok' }, `Published ${new Date(r.publishedAt).toLocaleDateString()}`), h('a', { class: 'btn btn-sm', href: r.notesUrl, rel: 'noopener' }, 'Release notes')),
      h(
        'div',
        { class: 'table-wrap' },
        h(
          'table',
          { class: 'table' },
          h('thead', {}, h('tr', {}, h('th', {}, 'Arch'), h('th', {}, 'File'), h('th', {}, 'SHA-256'), h('th', {}, 'Source'))),
          h('tbody', {}, r.checksums.map((c) => h('tr', {}, h('td', {}, c.arch), h('td', { class: 'nowrap' }, c.file), h('td', { class: 'hash' }, c.sha256), h('td', {}, c.source === 'release' ? 'Release asset' : 'SHA256SUMS')))),
        ),
      ),
    );
  } catch (e) {
    failed(el, `Release data unavailable: ${e.message}`, loadRelease);
  }
}

loadMarket();
loadRelease();
setInterval(loadMarket, 60_000);
