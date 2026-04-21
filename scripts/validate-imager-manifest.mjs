#!/usr/bin/env node
// Validate website/public/imager.json against the Raspberry Pi Imager
// os_list_v3 schema fields we care about. Exits non-zero on any failure.
//
// Flags:
//   --no-network   Skip HEAD-check of URLs (useful for offline CI / pre-publish).

import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

const args = new Set(process.argv.slice(2));
const NO_NETWORK = args.has("--no-network");

// Device tags accepted by rpi-imager in the wild. Upstream's
// os_list_imagingutility_v3.json only uses pi{1,2,3,4,5}-{32,64}bit — the Pi
// 400 and Zero 2 W are covered by pi4-* and pi3-* respectively. Anything else
// is silently ignored by the picker and usually indicates a typo.
const ALLOWED_DEVICES = new Set([
  "pi1-32bit",
  "pi2-32bit",
  "pi3-32bit",
  "pi3-64bit",
  "pi4-32bit",
  "pi4-64bit",
  "pi5-32bit",
  "pi5-64bit",
]);

const REQUIRED_OS_FIELDS = [
  "name",
  "description",
  "icon",
  "url",
  "extract_size",
  "extract_sha256",
  "image_download_size",
  "image_download_sha256",
  "release_date",
  "init_format",
  "website",
  "devices",
];

const errors = [];
const push = (msg) => errors.push(msg);

function isHttpUrl(s) {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function isHex64(s) {
  return typeof s === "string" && /^[0-9a-f]{64}$/.test(s);
}

function isIsoDate(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

async function headOk(url) {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
    });
    // GitHub release downloads redirect to S3 and may reject HEAD with 403 pre-publish.
    // Treat 2xx/3xx as ok; any 4xx/5xx as failure.
    return res.status < 400;
  } catch {
    return false;
  }
}

async function main() {
  const path = resolve(repoRoot, "website/public/imager.json");
  let raw;
  try {
    raw = await readFile(path, "utf8");
  } catch (err) {
    console.error(`cannot read ${path}: ${err.message}`);
    process.exit(2);
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    console.error(`invalid JSON: ${err.message}`);
    process.exit(2);
  }

  if (typeof data !== "object" || data === null) push("root is not an object");
  if (!Array.isArray(data.os_list)) push("os_list must be an array");
  if ("latest_version" in data && typeof data.latest_version !== "string")
    push("latest_version must be a string");

  if (Array.isArray(data.os_list) && data.os_list.length === 0) {
    if (typeof data.note !== "string" || !data.note.length) {
      push("empty os_list must include a 'note' string explaining the pending state");
    }
    // pending manifest is valid; skip per-entry checks
    if (errors.length) {
      console.error("validation failed:");
      for (const e of errors) console.error(" - " + e);
      process.exit(1);
    }
    console.log("imager.json valid (pending state, os_list empty)");
    return;
  }

  const urlsToCheck = [];

  for (let i = 0; i < data.os_list.length; i++) {
    const entry = data.os_list[i];
    const tag = `os_list[${i}]`;
    if (typeof entry !== "object" || entry === null) {
      push(`${tag} not an object`);
      continue;
    }
    for (const f of REQUIRED_OS_FIELDS) {
      if (!(f in entry)) push(`${tag} missing field: ${f}`);
    }
    if (entry.name && typeof entry.name !== "string")
      push(`${tag}.name not string`);
    if (entry.description && typeof entry.description !== "string")
      push(`${tag}.description not string`);
    if (entry.icon && !isHttpUrl(entry.icon))
      push(`${tag}.icon not http(s) URL`);
    if (entry.url && !isHttpUrl(entry.url))
      push(`${tag}.url not http(s) URL`);
    if (entry.website && !isHttpUrl(entry.website))
      push(`${tag}.website not http(s) URL`);
    if (!isHex64(entry.extract_sha256))
      push(`${tag}.extract_sha256 not 64-char lowercase hex`);
    if (!isHex64(entry.image_download_sha256))
      push(`${tag}.image_download_sha256 not 64-char lowercase hex`);
    if (!Number.isFinite(entry.extract_size) || entry.extract_size <= 0)
      push(`${tag}.extract_size must be positive number`);
    if (
      !Number.isFinite(entry.image_download_size) ||
      entry.image_download_size <= 0
    )
      push(`${tag}.image_download_size must be positive number`);
    if (!isIsoDate(entry.release_date))
      push(`${tag}.release_date must be YYYY-MM-DD`);
    if (entry.init_format !== "systemd")
      push(`${tag}.init_format should be "systemd"`);
    if (!Array.isArray(entry.devices) || entry.devices.length === 0) {
      push(`${tag}.devices must be non-empty array`);
    } else {
      for (const d of entry.devices) {
        if (!ALLOWED_DEVICES.has(d))
          push(`${tag}.devices contains unknown tag: ${d}`);
      }
    }
    if (entry.icon && isHttpUrl(entry.icon)) urlsToCheck.push(entry.icon);
    if (entry.url && isHttpUrl(entry.url)) urlsToCheck.push(entry.url);
  }

  if (!NO_NETWORK && urlsToCheck.length) {
    const results = await Promise.all(
      urlsToCheck.map(async (u) => [u, await headOk(u)]),
    );
    for (const [u, ok] of results) {
      if (!ok) push(`URL not reachable: ${u}`);
    }
  }

  if (errors.length) {
    console.error("validation failed:");
    for (const e of errors) console.error(" - " + e);
    process.exit(1);
  }
  console.log(`imager.json valid (${data.os_list.length} entries)`);
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});
