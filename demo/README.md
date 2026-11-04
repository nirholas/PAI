# PAI Cloud demo

Live: <https://pai.ninabrekkerese.workers.dev>

This Cloudflare Worker serves the PAI website. It also runs **PAI Cloud** at `/platform/`, a companion app you sign in to with a wallet (SIWE or SIWS). The app includes:

- **ISO verification.** Your browser hashes a PAI image locally in a Web Worker. The worker then compares the SHA-256 with the checksums in the latest GitHub release.
- **Bitcoin watchlist.** Track up to 20 addresses, watch-only, using mempool.space data.
- **Model loadouts.** Look up an Ollama model's real size and RAM needs from registry.ollama.ai. Then save a loadout and get the `ollama pull` script.
- **Hardware compatibility.** A public board of boot reports from the community.
- **Market data.** BTC and XMR prices, fees and network stats from Kraken, mempool.space and xmrchain.net, with public Monero RPC nodes as a fallback. The data is cached in D1.
- **API keys and usage.** Every `/api/v1/*` route also accepts `Authorization: Bearer sk_pai_…`.

## Layout

| Path | Purpose |
|---|---|
| `src/worker.ts` | API routes and the D1 schema bootstrap |
| `src/kit/` | Server half of the shared wallet-auth kit: SIWE/SIWS, sessions, API keys and usage logging |
| `kit/` | Browser half of the kit (`kit.js`, `kit.css`), served at `/kit/` |
| `platform/` | Landing page (`index.html`) and dashboard (`app/`) |
| `build.sh` | Builds `../website` and copies the output plus `platform/` into `public/` |

## Deploy

Put `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in the environment, then run:

```bash
npm install
./build.sh
npx wrangler d1 create pai-demo   # first deploy only; put the printed id in wrangler.toml
npx wrangler deploy
openssl rand -base64 48 | npx wrangler secret put SESSION_SECRET   # first deploy only
```

The worker creates its D1 tables the first time it gets a request.

## API

```bash
curl -s https://pai.ninabrekkerese.workers.dev/api/v1/release
curl -s https://pai.ninabrekkerese.workers.dev/api/v1/market
curl -s https://pai.ninabrekkerese.workers.dev/api/v1/models/llama3.2:3b
curl -s https://pai.ninabrekkerese.workers.dev/api/v1/overview -H "Authorization: Bearer $PAI_KEY"
```
