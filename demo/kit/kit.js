// Shared client for every demo: wallet sign-in (EVM via EIP-6963/EIP-1193, Solana via Wallet Standard-compatible injected providers),
// session state, API key and usage panels, toasts. No build step; import as an ES module.

const state = { user: undefined, listeners: new Set() };
const evmWallets = new Map();

window.addEventListener('eip6963:announceProvider', (e) => {
  const d = e.detail;
  if (d?.info?.uuid && d.provider) evmWallets.set(d.info.uuid, d);
});
window.dispatchEvent(new Event('eip6963:requestProvider'));

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) if (c != null && c !== false) el.append(c instanceof Node ? c : String(c));
  return el;
}

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const short = (a, n = 4) => (a && a.length > 2 * n + 3 ? `${a.slice(0, n + 2)}…${a.slice(-n)}` : a ?? '');
export const ago = (ms) => {
  if (!ms) return 'never';
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(ms).toLocaleDateString();
};
export const fmt = (n, d = 2) =>
  n == null || Number.isNaN(Number(n)) ? '—' : Number(n).toLocaleString(undefined, { maximumFractionDigits: d });
export const usd = (n) =>
  n == null || Number.isNaN(Number(n)) ? '—' : Number(n).toLocaleString(undefined, { currency: 'USD', maximumFractionDigits: Number(n) < 1 ? 6 : 2, style: 'currency' });

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function api(path, { body, headers, method } = {}) {
  let res;
  try {
    res = await fetch(path, {
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
      headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers },
      method: method ?? (body === undefined ? 'GET' : 'POST'),
    });
  } catch {
    throw new ApiError(0, 'Network error. Check your connection and try again.');
  }
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    if (res.status === 401 && state.user) setUser(null);
    throw new ApiError(res.status, data?.error ?? `Request failed (${res.status})`);
  }
  return data;
}

function setUser(u) {
  state.user = u;
  for (const fn of state.listeners) fn(u);
}

export const user = () => state.user;
export function onAuth(fn) {
  state.listeners.add(fn);
  if (state.user !== undefined) fn(state.user);
  return () => state.listeners.delete(fn);
}

export async function refresh() {
  try {
    const { user } = await api('/api/me');
    setUser(user);
  } catch {
    setUser(null);
  }
  return state.user;
}

export function toast(message, kind = 'info') {
  let box = $('.kit-toasts');
  if (!box) document.body.append((box = h('div', { 'aria-live': 'polite', class: 'kit-toasts' })));
  const t = h('div', { class: `kit-toast kit-toast-${kind}`, role: kind === 'error' ? 'alert' : 'status' }, message);
  box.append(t);
  setTimeout(() => t.classList.add('out'), 4200);
  setTimeout(() => t.remove(), 4600);
}

export async function copy(text, label = 'Copied') {
  try {
    await navigator.clipboard.writeText(text);
    toast(label, 'success');
  } catch {
    toast('Copy failed. Select the text and copy it manually.', 'error');
  }
}

// ---------- wallets ----------

export function listEvmWallets() {
  const list = [...evmWallets.values()].map((d) => ({ icon: d.info.icon, name: d.info.name, provider: d.provider }));
  if (!list.length && window.ethereum) list.push({ icon: null, name: window.ethereum.isMetaMask ? 'MetaMask' : 'Browser wallet', provider: window.ethereum });
  return list;
}

export function listSolWallets() {
  const out = [];
  const seen = new Set();
  const add = (name, p) => {
    if (p && !seen.has(p) && typeof p.connect === 'function' && typeof p.signMessage === 'function') {
      seen.add(p);
      out.push({ name, provider: p });
    }
  };
  add('Phantom', window.phantom?.solana);
  add('Solflare', window.solflare);
  add('Backpack', window.backpack?.solana ?? window.backpack);
  add('Solana wallet', window.solana);
  return out;
}

let activeEvm = null;
let activeSol = null;
export const evm = () => activeEvm ?? listEvmWallets()[0]?.provider ?? null;
export const sol = () => activeSol ?? listSolWallets()[0]?.provider ?? null;

const utf8Hex = (s) => `0x${[...new TextEncoder().encode(s)].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
const b64 = (bytes) => btoa(String.fromCharCode(...bytes));

function walletError(e) {
  if (e?.code === 4001 || /reject|denied|cancel/i.test(e?.message ?? '')) return new Error('Signature request was rejected in the wallet.');
  return e instanceof Error ? e : new Error(String(e?.message ?? e));
}

export async function signInEvm(provider = evm()) {
  if (!provider) throw new Error('No Ethereum wallet detected. Install MetaMask, Rabby or Coinbase Wallet, then reload.');
  try {
    const [address] = await provider.request({ method: 'eth_requestAccounts' });
    const chainId = Number.parseInt(await provider.request({ method: 'eth_chainId' }), 16);
    const { message, nonce } = await api('/api/auth/challenge', { body: { address, chain: 'evm', chainId } });
    const signature = await provider.request({ method: 'personal_sign', params: [utf8Hex(message), address] });
    const { user } = await api('/api/auth/verify', { body: { nonce, signature } });
    activeEvm = provider;
    setUser(user);
    return user;
  } catch (e) {
    throw walletError(e);
  }
}

export async function signInSol(provider = sol()) {
  if (!provider) throw new Error('No Solana wallet detected. Install Phantom, Solflare or Backpack, then reload.');
  try {
    const res = await provider.connect();
    const address = (res?.publicKey ?? provider.publicKey).toString();
    const { message, nonce } = await api('/api/auth/challenge', { body: { address, chain: 'sol' } });
    const signed = await provider.signMessage(new TextEncoder().encode(message), 'utf8');
    const sig = signed?.signature ?? signed;
    const { user } = await api('/api/auth/verify', { body: { nonce, signature: b64(new Uint8Array(sig)) } });
    activeSol = provider;
    setUser(user);
    return user;
  } catch (e) {
    throw walletError(e);
  }
}

export async function signOut() {
  await api('/api/auth/logout', { method: 'POST' });
  setUser(null);
}

export async function switchEvmChain(chain) {
  const p = evm();
  if (!p) throw new Error('No Ethereum wallet detected.');
  const hex = `0x${chain.id.toString(16)}`;
  try {
    await p.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hex }] });
  } catch (e) {
    if (e?.code !== 4902) throw walletError(e);
    await p.request({
      method: 'wallet_addEthereumChain',
      params: [{ blockExplorerUrls: [chain.explorer], chainId: hex, chainName: chain.name, nativeCurrency: chain.currency, rpcUrls: [chain.rpc] }],
    });
  }
}

// ---------- UI ----------

export function openSignIn() {
  const evmList = listEvmWallets();
  const solList = listSolWallets();
  const err = h('p', { class: 'kit-err', hidden: true });
  const close = () => dlg.remove();
  const run = async (btn, fn) => {
    err.hidden = true;
    btn.disabled = true;
    btn.classList.add('loading');
    try {
      await fn();
      close();
      toast('Signed in', 'success');
    } catch (e) {
      err.textContent = e.message;
      err.hidden = false;
    } finally {
      btn.disabled = false;
      btn.classList.remove('loading');
    }
  };
  const row = (w, kind) => {
    const b = h(
      'button',
      { class: 'kit-wallet', type: 'button' },
      w.icon ? h('img', { alt: '', src: w.icon }) : h('span', { class: `kit-chain-dot ${kind}` }),
      h('span', {}, w.name),
      h('small', {}, kind === 'evm' ? 'Ethereum · Base · BNB · L2s' : 'Solana'),
    );
    b.addEventListener('click', () => run(b, () => (kind === 'evm' ? signInEvm(w.provider) : signInSol(w.provider))));
    return b;
  };
  const none = (label, href) => h('a', { class: 'kit-wallet muted', href, rel: 'noopener', target: '_blank' }, h('span', { class: 'kit-chain-dot' }), h('span', {}, label), h('small', {}, 'Install'));
  const dlg = h(
    'div',
    { 'aria-modal': 'true', class: 'kit-modal', role: 'dialog' },
    h(
      'div',
      { class: 'kit-modal-card' },
      h('button', { 'aria-label': 'Close', class: 'kit-x', onclick: close, type: 'button' }, '×'),
      h('h3', {}, 'Sign in with your wallet'),
      h('p', { class: 'muted' }, 'You sign a one-time message. No transaction, no gas, no email.'),
      h('div', { class: 'kit-wallets' }, evmList.length ? evmList.map((w) => row(w, 'evm')) : none('Ethereum wallet', 'https://metamask.io/download/'), solList.length ? solList.map((w) => row(w, 'sol')) : none('Solana wallet', 'https://phantom.com/download')),
      err,
    ),
  );
  dlg.addEventListener('click', (e) => e.target === dlg && close());
  document.addEventListener('keydown', function onKey(e) {
    if (e.key === 'Escape') {
      close();
      document.removeEventListener('keydown', onKey);
    }
  });
  document.body.append(dlg);
  dlg.querySelector('.kit-wallet')?.focus();
}

/** Renders the sign-in button / account menu into every `[data-kit-auth]` element. */
export function mountAuth({ appHref = '/app' } = {}) {
  const render = (u) => {
    for (const el of $$('[data-kit-auth]')) {
      el.replaceChildren();
      if (u === undefined) el.append(h('span', { class: 'skeleton', style: 'width:120px;height:36px;display:inline-block' }));
      else if (!u) el.append(h('button', { class: 'btn btn-primary', onclick: openSignIn, type: 'button' }, 'Sign in'));
      else {
        const menu = h(
          'div',
          { class: 'kit-menu', hidden: true },
          h('a', { href: appHref }, 'Dashboard'),
          h('a', { href: `${appHref}#keys` }, 'API keys'),
          h('button', { onclick: () => copy(u.address, 'Address copied'), type: 'button' }, 'Copy address'),
          h('button', { onclick: () => signOut().catch((e) => toast(e.message, 'error')), type: 'button' }, 'Sign out'),
        );
        const btn = h('button', { 'aria-haspopup': 'menu', class: 'btn kit-account', type: 'button' }, h('span', { class: `kit-chain-dot ${u.chain}` }), short(u.address));
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          menu.hidden = !menu.hidden;
        });
        document.addEventListener('click', () => (menu.hidden = true));
        el.append(h('div', { class: 'kit-account-wrap' }, btn, menu));
      }
    }
  };
  onAuth(render);
  render(state.user);
  if (state.user === undefined) refresh();
}

/** Shows `signedIn` content only for authenticated users; otherwise a sign-in gate. */
export function gate(root, { title = 'Sign in to continue', text = 'Connect an Ethereum or Solana wallet to use the platform.' } = {}) {
  const g = h('div', { class: 'empty card' }, h('h3', {}, title), h('p', { class: 'muted' }, text), h('button', { class: 'btn btn-primary', onclick: openSignIn, type: 'button' }, 'Sign in with wallet'));
  const sk = h('div', { class: 'card' }, h('div', { class: 'skeleton', style: 'height:18px;width:40%' }), h('div', { class: 'skeleton', style: 'height:14px;width:70%;margin-top:12px' }));
  root.before(g, sk);
  return new Promise((resolve) => {
    onAuth((u) => {
      sk.remove();
      g.hidden = !!u;
      root.hidden = !u;
      if (u) resolve(u);
    });
  });
}

export function mountKeys(el, { endpointHint } = {}) {
  const list = h('div');
  const name = h('input', { 'aria-label': 'Key name', class: 'input', maxlength: '60', placeholder: 'Key name, e.g. laptop' });
  const reveal = h('div', { hidden: true });
  const load = async () => {
    list.replaceChildren(h('div', { class: 'skeleton', style: 'height:44px' }));
    try {
      const { keys } = await api('/api/keys');
      if (!keys.length) return list.replaceChildren(h('p', { class: 'empty-inline muted' }, 'No API keys yet. Create one to call the API from scripts or agents.'));
      list.replaceChildren(
        h(
          'table',
          { class: 'table' },
          h('thead', {}, h('tr', {}, h('th', {}, 'Name'), h('th', {}, 'Key'), h('th', {}, 'Created'), h('th', {}, 'Last used'), h('th'))),
          h(
            'tbody',
            {},
            keys.map((k) =>
              h(
                'tr',
                {},
                h('td', {}, k.name),
                h('td', {}, h('code', {}, k.prefix)),
                h('td', {}, ago(k.created_at)),
                h('td', {}, ago(k.last_used)),
                h('td', { class: 'right' }, h('button', { class: 'btn btn-sm btn-danger', onclick: () => revoke(k), type: 'button' }, 'Revoke')),
              ),
            ),
          ),
        ),
      );
    } catch (e) {
      list.replaceChildren(h('p', { class: 'kit-err' }, e.message, ' ', h('button', { class: 'btn btn-sm', onclick: load, type: 'button' }, 'Retry')));
    }
  };
  const revoke = async (k) => {
    const ok = await confirmDialog(`Revoke "${k.name}"? Anything using this key stops working immediately.`, 'Revoke key');
    if (!ok) return;
    try {
      await api(`/api/keys/${k.id}`, { method: 'DELETE' });
      toast('Key revoked', 'success');
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  const create = h('button', { class: 'btn btn-primary', type: 'submit' }, 'Create key');
  const form = h('form', { class: 'row' }, name, create);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!name.value.trim()) return name.focus();
    create.disabled = true;
    try {
      const { key } = await api('/api/keys', { body: { name: name.value } });
      name.value = '';
      reveal.hidden = false;
      reveal.replaceChildren(
        h(
          'div',
          { class: 'callout' },
          h('strong', {}, 'Copy this key now. It is shown once.'),
          h('div', { class: 'row' }, h('code', { class: 'grow mono-wrap' }, key.secret), h('button', { class: 'btn btn-sm', onclick: () => copy(key.secret, 'Key copied'), type: 'button' }, 'Copy')),
          endpointHint ? h('pre', { class: 'code' }, endpointHint(key.secret)) : null,
        ),
      );
      load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      create.disabled = false;
    }
  });
  el.replaceChildren(form, reveal, list);
  load();
}

export function mountUsage(el) {
  const load = async () => {
    el.replaceChildren(h('div', { class: 'skeleton', style: 'height:120px' }));
    try {
      const { recent, totals } = await api('/api/usage');
      if (!recent.length) return el.replaceChildren(h('p', { class: 'empty-inline muted' }, 'No activity yet. Everything you run here is logged to this history.'));
      el.replaceChildren(
        h('div', { class: 'chips' }, totals.map((t) => h('span', { class: 'chip' }, `${t.action} · ${t.calls}`, t.errors ? h('em', { class: 'bad' }, ` ${t.errors} failed`) : null))),
        h(
          'table',
          { class: 'table' },
          h('thead', {}, h('tr', {}, h('th', {}, 'When'), h('th', {}, 'Action'), h('th', {}, 'Detail'), h('th', { class: 'right' }, 'ms'))),
          h(
            'tbody',
            {},
            recent.map((r) =>
              h(
                'tr',
                {},
                h('td', { class: 'nowrap' }, ago(r.created_at)),
                h('td', {}, h('span', { class: `badge ${r.ok ? 'ok' : 'bad'}` }, r.action)),
                h('td', { class: 'mono trunc', title: r.detail ?? '' }, r.detail ?? ''),
                h('td', { class: 'right' }, r.ms ?? ''),
              ),
            ),
          ),
        ),
      );
    } catch (e) {
      el.replaceChildren(h('p', { class: 'kit-err' }, e.message, ' ', h('button', { class: 'btn btn-sm', onclick: load, type: 'button' }, 'Retry')));
    }
  };
  load();
  return { reload: load };
}

export function confirmDialog(text, okLabel = 'Confirm') {
  return new Promise((resolve) => {
    const done = (v) => {
      d.remove();
      resolve(v);
    };
    const d = h(
      'div',
      { 'aria-modal': 'true', class: 'kit-modal', role: 'dialog' },
      h(
        'div',
        { class: 'kit-modal-card' },
        h('p', {}, text),
        h('div', { class: 'row end' }, h('button', { class: 'btn', onclick: () => done(false), type: 'button' }, 'Cancel'), h('button', { class: 'btn btn-danger', onclick: () => done(true), type: 'button' }, okLabel)),
      ),
    );
    document.body.append(d);
    d.querySelector('.btn-danger').focus();
  });
}

/** Wires `.tabs [data-tab]` buttons to `[data-panel]` sections, synced with location.hash. */
export function tabs(root = document) {
  const btns = $$('[data-tab]', root);
  const show = (id) => {
    if (!btns.some((b) => b.dataset.tab === id)) id = btns[0]?.dataset.tab;
    for (const b of btns) b.setAttribute('aria-selected', String(b.dataset.tab === id));
    for (const p of $$('[data-panel]', root)) p.hidden = p.dataset.panel !== id;
  };
  for (const b of btns) b.addEventListener('click', () => history.replaceState(null, '', `#${b.dataset.tab}`) || show(b.dataset.tab));
  window.addEventListener('hashchange', () => show(location.hash.slice(1)));
  show(location.hash.slice(1));
}

/** Runs an async action bound to a button, with loading state and error toast. */
export async function busy(btn, fn) {
  btn.disabled = true;
  btn.classList.add('loading');
  try {
    return await fn();
  } catch (e) {
    toast(e.message, 'error');
    return undefined;
  } finally {
    btn.disabled = false;
    btn.classList.remove('loading');
  }
}
