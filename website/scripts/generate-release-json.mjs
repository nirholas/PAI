#!/usr/bin/env node
/**
 * Fetches latest GitHub release metadata and writes public/release.json.
 * Runs as npm prebuild so Astro copies it into dist/ at build time.
 * Gracefully no-ops (leaves placeholder) if no release exists or no token.
 */
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT = join(__dirname, '../public/release.json');

const REPO = process.env.GITHUB_REPOSITORY ?? 'nirholas/pai';
const TOKEN = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;

const ISO_RE = /\.(iso|iso\.sha256|iso\.asc)$|^SHA256SUMS(\.asc)?$/;

async function main() {
  const authHeaders = TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {};

  let res;
  try {
    res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { ...authHeaders, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    });
  } catch (err) {
    console.warn(`[release-json] fetch failed: ${err.message} — keeping placeholder`);
    return;
  }

  if (res.status === 404) {
    console.warn('[release-json] no releases yet — keeping placeholder');
    return;
  }

  if (!res.ok) {
    console.warn(`[release-json] GitHub API ${res.status} — keeping placeholder`);
    return;
  }

  const release = await res.json();
  const version = release.tag_name.replace(/^v/, '');

  const files = release.assets
    .filter(a => ISO_RE.test(a.name))
    .map(a => ({
      name: a.name,
      size: a.size,
      sha256: null,
      url: a.browser_download_url,
    }));

  const data = {
    version,
    publishedAt: release.published_at,
    files,
    signingKeyFingerprint: process.env.GPG_KEY_FINGERPRINT ?? '',
  };

  writeFileSync(OUTPUT, JSON.stringify(data, null, 2) + '\n');
  console.log(`[release-json] wrote v${version} (${files.length} files)`);
}

main();
