#!/usr/bin/env node
// Self-test for scripts/validate-imager-manifest.mjs.
// Writes a handful of fixture manifests to a temp dir, runs the validator
// against each, and asserts the exit code matches the expectation.

import { mkdtemp, writeFile, mkdir, cp } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const validator = resolve(__dirname, "validate-imager-manifest.mjs");

const VALID_ENTRY = {
  name: "PAI — Private AI",
  description: "test",
  icon: "https://pai.direct/imager/pai-icon.png",
  url: "https://example.com/pai.img.xz",
  extract_size: 4294967296,
  extract_sha256: "a".repeat(64),
  image_download_size: 1234567890,
  image_download_sha256: "b".repeat(64),
  release_date: "2026-04-20",
  init_format: "systemd",
  website: "https://pai.direct",
  devices: ["pi4-64bit", "pi5-64bit"],
};

const CASES = [
  {
    name: "pending manifest with note",
    manifest: { latest_version: "0.1.0", note: "pending", os_list: [] },
    expectExit: 0,
  },
  {
    name: "empty os_list without note",
    manifest: { latest_version: "0.1.0", os_list: [] },
    expectExit: 1,
  },
  {
    name: "fully populated manifest",
    manifest: { latest_version: "0.1.0", os_list: [VALID_ENTRY] },
    expectExit: 0,
  },
  {
    name: "invalid device tag",
    manifest: {
      latest_version: "0.1.0",
      os_list: [{ ...VALID_ENTRY, devices: ["pi400-64bit"] }],
    },
    expectExit: 1,
  },
  {
    name: "short sha256",
    manifest: {
      latest_version: "0.1.0",
      os_list: [{ ...VALID_ENTRY, extract_sha256: "deadbeef" }],
    },
    expectExit: 1,
  },
  {
    name: "non-iso date",
    manifest: {
      latest_version: "0.1.0",
      os_list: [{ ...VALID_ENTRY, release_date: "April 20 2026" }],
    },
    expectExit: 1,
  },
  {
    name: "missing required field",
    manifest: (() => {
      const { description: _omit, ...rest } = VALID_ENTRY;
      return { latest_version: "0.1.0", os_list: [rest] };
    })(),
    expectExit: 1,
  },
];

async function prepareSandbox(manifest) {
  const root = await mkdtemp(join(tmpdir(), "pai-imager-test-"));
  await mkdir(join(root, "scripts"), { recursive: true });
  await mkdir(join(root, "website/public"), { recursive: true });
  // Copy the validator so it resolves its target via its own __dirname.
  await cp(validator, join(root, "scripts/validate-imager-manifest.mjs"));
  await writeFile(
    join(root, "website/public/imager.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );
  return root;
}

function run(cwd) {
  const res = spawnSync(
    process.execPath,
    ["scripts/validate-imager-manifest.mjs", "--no-network"],
    { cwd, encoding: "utf8" },
  );
  return { code: res.status ?? 1, stderr: res.stderr, stdout: res.stdout };
}

let failed = 0;
for (const c of CASES) {
  const root = await prepareSandbox(c.manifest);
  const { code, stderr, stdout } = run(root);
  const ok = code === c.expectExit;
  const tag = ok ? "PASS" : "FAIL";
  console.log(`${tag}: ${c.name} (exit=${code}, expected=${c.expectExit})`);
  if (!ok) {
    failed++;
    if (stdout) console.log("  stdout:", stdout.trim());
    if (stderr) console.log("  stderr:", stderr.trim());
  }
}

if (failed) {
  console.error(`\n${failed}/${CASES.length} cases failed`);
  process.exit(1);
}
console.log(`\nall ${CASES.length} cases passed`);

// Also sanity-check the generator in pending mode with no release.json side effects.
// We simulate "no dist/, version = XYZ" in a fresh sandbox so we don't touch
// the real repo. This is a smoke test — exit 0 and a valid pending manifest.
{
  const root = await mkdtemp(join(tmpdir(), "pai-gen-test-"));
  await mkdir(join(root, "scripts"), { recursive: true });
  await mkdir(join(root, "website/src/data"), { recursive: true });
  await mkdir(join(root, "website/public"), { recursive: true });
  await cp(
    resolve(__dirname, "gen-imager-manifest.mjs"),
    join(root, "scripts/gen-imager-manifest.mjs"),
  );
  await writeFile(
    join(root, "website/src/data/release.json"),
    JSON.stringify({
      version: "9.9.9-test",
      buildDate: "2026-04-20",
    }),
  );
  const res = spawnSync(
    process.execPath,
    ["scripts/gen-imager-manifest.mjs", "--local", "--dry-run"],
    { cwd: root, encoding: "utf8" },
  );
  const exit = res.status ?? 1;
  const jsonStart = res.stdout.indexOf("{");
  let parsed = null;
  try {
    parsed = JSON.parse(res.stdout.slice(jsonStart));
  } catch {
    /* ignore */
  }
  if (
    exit !== 0 ||
    !parsed ||
    !Array.isArray(parsed.os_list) ||
    parsed.os_list.length !== 0 ||
    !parsed.note
  ) {
    console.error("FAIL: generator pending-state smoke test");
    console.error("  exit=", exit, "stdout=", res.stdout, "stderr=", res.stderr);
    process.exit(1);
  }
  console.log("PASS: generator pending-state smoke test");
}

void repoRoot;
