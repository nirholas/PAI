---
title: CLI JSON Shapes
description: Stable JSON output contracts for pai-status and pai-recommend-model — what dashboards, applets, and scripts can rely on.
category: api
status: stable
---

# CLI JSON Shapes

PAI's introspection CLIs (`pai-status`, `pai-recommend-model`) emit
structured JSON when invoked with `--json`. This page documents the
shape so downstream consumers — Waybar applets, the future GTK
dashboard, third-party scripts — can depend on a stable contract.

> **Stability rule:** within a major PAI version, fields documented
> here are append-only. New fields may be added; existing fields keep
> their meaning and type. Removals or renames are reserved for major
> bumps and announced in [CHANGELOG.md](../CHANGELOG.md).

If you build on top of these shapes, **pin your check to the field
names you read** rather than to total field count, ordering, or
key order.

---

## `pai-status --json`

Run on a PAI system to get a single JSON object snapshotting the
private-mode posture and the running Ollama daemon.

```jsonc
{
  "healthy": true,            // bool — true when no privacy default is bypassed
  "ollama": {
    "state": "running",        // "running" | "stopped" | "running (no systemd unit)"
    "loaded_model": "qwen3:8b",// model name from /api/ps; "none" if idle
    "default_model": "qwen3:8b"// from ~/.config/pai/default-model; "unset" if absent
  },
  "memory": {
    "ram_total_mb": 16000,     // int
    "ram_used_mb": 8123,       // int
    "ram_used_pct": 51,        // int 0..100
    "vram_total_mb": 0,        // int — 0 when no NVIDIA GPU detected
    "vram_used_mb": 0,         // int
    "gpu": "none"              // "none" | NVIDIA GPU name from nvidia-smi
  },
  "network": {
    "listening_sockets": 4,    // int — distinct local listen addresses (TCP)
    "outbound_established": 0, // int — established TCP outbound, ex-loopback
    "outbound_top": ""          // string — comma-summary of busiest peers
  },
  "firewall": {
    "ufw_state": "active",     // "active" | "inactive" | "unknown"
    "default_in": "deny",      // "allow" | "deny" | "reject" | "unknown"
    "default_out": "allow"     // same
  },
  "privacy": {
    "mac_spoof": "on",         // "on" | "off" | "unknown"
    "tor": "off"               // "running" | "off" | "unknown"
  },
  "persistence": {
    "state": "absent"          // "active" | "locked" | "absent" | "unknown"
  }
}
```

### Fields that drive `"healthy": true`

`pai-status` sets `"healthy": false` (and exits 1) when **any** of the
following hold:

- `firewall.ufw_state` is not `"active"`, **or**
- `firewall.default_in` is not `"deny"`, **or**
- `network.outbound_established` is non-zero on a default boot (this
  is configurable per-deployment in a future release), **or**
- `ollama.state` is `"stopped"`.

Consumers wanting a single binary signal should read `"healthy"` and
not re-derive it.

### Exit codes

| Exit | Meaning                                                      |
| ---- | ------------------------------------------------------------ |
| `0`  | JSON printed; `"healthy": true`.                              |
| `1`  | JSON printed; `"healthy": false` (something to look at).      |
| `2`  | Usage error — bad flag.                                      |

---

## `pai-recommend-model --json`

Run on any system (PAI or not) to get a model-sizing recommendation
based on detected RAM and GPU.

```jsonc
{
  "model": "qwen2.5:14b",       // string — the recommended Ollama model tag
  "tier": "large",               // "tiny" | "small" | "medium" | "large" | "xl"
  "pull_needed": true,           // bool — false when the recommendation is the baked-in tiny model
  "size_note": "~9 GB download", // string — human download/disk hint
  "ram_mb": 32768,               // int — total system RAM
  "ram_gb": 32,                  // int — convenience field
  "gpu_vendor": "nvidia",        // "nvidia" | "amd" | "intel" | "none"
  "gpu_vram_mb": 24576,          // int — VRAM if detectable; 0 otherwise
  "gpu_model": "NVIDIA RTX 4090",// string — empty when not detected
  "effective_mb": 24576,         // int — the memory figure the tier was chosen against
  "effective_source": "GPU VRAM" // "GPU VRAM" | "system RAM"
}
```

### `--shell` variant

The same data can be sourced into shell variables (handy for scripts
that want to consume the recommendation without parsing JSON):

```bash
eval "$(pai-recommend-model --shell)"
echo "Recommended: $PAI_MODEL ($PAI_SIZE_NOTE)"
```

The `PAI_*` variable names mirror the JSON keys with `PAI_` prefix
and uppercase-snake-case (`PAI_MODEL`, `PAI_TIER`, `PAI_GPU_VRAM_MB`,
…). The shell-variant is convenient but cannot represent nested
objects — use `--json` if you need the full structure.

### Tier ladder

The recommender selects a tier based on `effective_mb`:

| Tier      | Effective memory   | Default model      |
| --------- | ------------------ | ------------------ |
| `tiny`    | `< 4 GB`           | `llama3.2:1b`      |
| `small`   | `4 – 12 GB`        | `llama3.2:3b`      |
| `medium`  | `12 – 24 GB`       | `phi3:medium`      |
| `large`   | `24 – 48 GB`       | `qwen2.5:14b`      |
| `xl`      | `≥ 48 GB`          | `qwen2.5:32b`      |

The `--name` form prints just the model tag, suitable for
`ollama pull "$(pai-recommend-model --name)"`.

### Exit codes

| Exit | Meaning                                  |
| ---- | ---------------------------------------- |
| `0`  | Recommendation produced.                 |
| `1`  | Could not detect system RAM.             |
| `2`  | Usage error — bad flag.                  |

---

## See also

- [`pai-status(1)`](../../config/includes.chroot_after_packages/usr/share/man/man1/pai-status.1) — man page for the CLI.
- [`pai-recommend-model(1)`](../../config/includes.chroot_after_packages/usr/share/man/man1/pai-recommend-model.1) — man page for the recommender.
- [reference.md](./reference.md) — index of all PAI APIs.
- [endpoints.md](./endpoints.md) — Ollama HTTP API that PAI relies on.
