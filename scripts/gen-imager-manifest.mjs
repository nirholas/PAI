#!/usr/bin/env node
// Generate Raspberry Pi Imager os_list_v3 manifest for PAI.
// Reads version from website/src/data/release.json, fetches the matching
// GitHub release, locates the arm64 .img.xz asset and its .img.json sidecar,
// and writes website/public/imager.json.
//
// Flags:
//   --dry-run   Print manifest to stdout instead of writing.
//   --local     Read sidecar from ./dist/pai-<version>-arm64.img.json. When no
//               sidecar is present and the committed website/public/imager.json
//               already has a populated os_list for the current version, leave
//               it untouched (so website builds don't wipe real release data).
//
// Exit codes:
//   0  success
//   1  network / asset-lookup error
//   2  sidecar parse failure

import { readFile, writeFile, stat } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const LOCAL = args.has("--local");

// Tracking label for the open Pi-image build task. Points at the repo's
// issue list so the link stays valid whether or not a specific issue exists.
const PLACEHOLDER_ISSUE =
  "https://github.com/nirholas/pai/issues?q=raspberry+pi+image";
const REPO = (() => {
  const r = process.env.PAI_REPO || "nirholas/pai";
  if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(r))
    throw new Error(`PAI_REPO must be "owner/repo", got: ${r}`);
  return r;
})();
// Device tags accepted by rpi-imager. Upstream only recognizes pi{3,4,5}-{32,64}bit;
// the Pi 400 is covered by pi4-64bit and the Zero 2 W by pi3-64bit (verified against
// downloads.raspberrypi.org/os_list_imagingutility_v3.json).
const DEVICES = ["pi3-64bit", "pi4-64bit", "pi5-64bit"];

function log(msg) {
  // eslint-disable-next-line no-console
  console.log(`[gen-imager-manifest] ${msg}`);
}
function die(code, msg) {
  // eslint-disable-next-line no-console
  console.error(`[gen-imager-manifest] ERROR: ${msg}`);
  process.exit(code);
}

async function readReleaseJson() {
  const p = resolve(repoRoot, "website/src/data/release.json");
  log(`reading ${p}`);
  const raw = await readFile(p, "utf8");
  return JSON.parse(raw);
}

const FETCH_TIMEOUT_MS = Number(process.env.PAI_FETCH_TIMEOUT_MS || 15000);

function authHeaders(url) {
  const h = { "user-agent": "pai-imager-manifest-gen" };
  if (process.env.GITHUB_TOKEN && url.startsWith("https://api.github.com/")) {
    h.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    h["x-github-api-version"] = "2022-11-28";
  }
  return h;
}

async function doFetch(url, extraHeaders = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  log(`GET ${url}`);
  try {
    const res = await fetch(url, {
      headers: { ...authHeaders(url), ...extraHeaders },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} for ${url}: ${body.slice(0, 200)}`);
    }
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url) {
  const res = await doFetch(url, { accept: "application/json" });
  return res.json();
}

async function fetchText(url) {
  const res = await doFetch(url);
  return res.text();
}

function pendingManifest(version, note) {
  return {
    latest_version: version,
    note,
    os_list: [],
  };
}

function buildManifest({
  version,
  releaseDate,
  assetUrl,
  sidecar,
}) {
  return {
    latest_version: version,
    os_list: [
      {
        name: "PAI — Private AI",
        description:
          "Debian + Sway + Ollama · Private, offline AI on a bootable Pi",
        icon: "https://pai.direct/imager/pai-icon.png",
        url: assetUrl,
        extract_size: sidecar.extract_size,
        extract_sha256: sidecar.extract_sha256,
        image_download_size: sidecar.image_download_size,
        image_download_sha256: sidecar.image_download_sha256,
        release_date: sidecar.release_date || releaseDate,
        init_format: "systemd",
        website: "https://pai.direct",
        devices: DEVICES,
      },
    ],
  };
}

function validateSidecar(obj) {
  const required = [
    "extract_size",
    "extract_sha256",
    "image_download_size",
    "image_download_sha256",
  ];
  for (const k of required) {
    if (!(k in obj)) throw new Error(`sidecar missing field: ${k}`);
  }
  const hex = /^[0-9a-f]{64}$/;
  if (!hex.test(obj.extract_sha256))
    throw new Error("extract_sha256 is not lowercase 64-char hex");
  if (!hex.test(obj.image_download_sha256))
    throw new Error("image_download_sha256 is not lowercase 64-char hex");
  if (!Number.isFinite(obj.extract_size) || obj.extract_size <= 0)
    throw new Error("extract_size must be positive number");
  if (!Number.isFinite(obj.image_download_size) || obj.image_download_size <= 0)
    throw new Error("image_download_size must be positive number");
}

async function loadExistingManifest() {
  const p = resolve(repoRoot, "website/public/imager.json");
  try {
    await stat(p);
  } catch {
    return null;
  }
  try {
    const raw = await readFile(p, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    log(`existing manifest unreadable (${err.message}); ignoring`);
    return null;
  }
}

async function loadLocalSidecar(version) {
  const path = resolve(repoRoot, `dist/pai-${version}-arm64.img.json`);
  log(`reading local sidecar ${path}`);
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw);
}

async function resolveFromGitHub(version) {
  const tag = `v${version}`;
  let release;
  try {
    release = await fetchJson(
      `https://api.github.com/repos/${REPO}/releases/tags/${tag}`,
    );
  } catch (err) {
    log(`release ${tag} not found: ${err.message}`);
    return null;
  }
  const imgAsset = (release.assets || []).find(
    (a) => a.name === `pai-${version}-arm64.img.xz`,
  );
  const sidecarAsset = (release.assets || []).find(
    (a) => a.name === `pai-${version}-arm64.img.json`,
  );
  if (!imgAsset || !sidecarAsset) {
    log(
      `release ${tag} has no arm64 image assets (img.xz=${!!imgAsset}, sidecar=${!!sidecarAsset})`,
    );
    return null;
  }
  const sidecarText = await fetchText(sidecarAsset.browser_download_url);
  let sidecar;
  try {
    sidecar = JSON.parse(sidecarText);
  } catch (err) {
    throw Object.assign(new Error(`sidecar JSON parse: ${err.message}`), {
      code: 2,
    });
  }
  return { assetUrl: imgAsset.browser_download_url, sidecar };
}

async function main() {
  const release = await readReleaseJson();
  const version = release.version;
  const releaseDate = release.buildDate || new Date().toISOString().slice(0, 10);
  log(`version=${version} releaseDate=${releaseDate} local=${LOCAL} dryRun=${DRY_RUN}`);

  let manifest;

  if (LOCAL) {
    try {
      const sidecar = await loadLocalSidecar(version);
      validateSidecar(sidecar);
      const assetUrl = `https://github.com/${REPO}/releases/download/v${version}/pai-${version}-arm64.img.xz`;
      manifest = buildManifest({ version, releaseDate, assetUrl, sidecar });
    } catch (err) {
      if (err.code === "ENOENT") {
        const existing = await loadExistingManifest();
        if (
          existing &&
          Array.isArray(existing.os_list) &&
          existing.os_list.length > 0 &&
          existing.latest_version === version
        ) {
          log(
            `no local sidecar; existing manifest is populated for v${version}, preserving it`,
          );
          if (DRY_RUN) {
            process.stdout.write(JSON.stringify(existing, null, 2) + "\n");
          }
          return;
        }
        log(`no local sidecar; emitting pending manifest`);
        manifest = pendingManifest(
          version,
          `PAI arm64 images for Raspberry Pi are pending — see ${PLACEHOLDER_ISSUE}`,
        );
      } else if (err instanceof SyntaxError) {
        die(2, `sidecar JSON parse failed: ${err.message}`);
      } else {
        die(2, err.message);
      }
    }
  } else {
    let resolved;
    try {
      resolved = await resolveFromGitHub(version);
    } catch (err) {
      if (err.code === 2) die(2, err.message);
      die(1, `github lookup failed: ${err.message}`);
    }
    if (resolved) {
      try {
        validateSidecar(resolved.sidecar);
      } catch (err) {
        die(2, err.message);
      }
      manifest = buildManifest({
        version,
        releaseDate,
        assetUrl: resolved.assetUrl,
        sidecar: resolved.sidecar,
      });
    } else {
      log(`emitting pending manifest`);
      manifest = pendingManifest(
        version,
        `PAI arm64 images for Raspberry Pi are pending — see ${PLACEHOLDER_ISSUE}`,
      );
    }
  }

  const out = JSON.stringify(manifest, null, 2) + "\n";
  if (DRY_RUN) {
    process.stdout.write(out);
    return;
  }
  const target = resolve(repoRoot, "website/public/imager.json");
  await writeFile(target, out);
  log(`wrote ${target}`);
}

main().catch((err) => {
  die(1, err?.stack || String(err));
});
