# Known Issues

A living triage log of bugs, rough edges, and environmental quirks.
This file is curated; the authoritative source of truth is the GitHub
issue tracker: <https://github.com/> (see project repo).

For help beyond this list, see [docs/troubleshooting.md](advanced/troubleshooting.md),
[FAQ.md](reference/faq.md), or [SUPPORT.md](SUPPORT.md).

## Entry template

```
### [OPEN] Short title
**Affects:** versions / architectures
**Symptom:** what the user sees
**Cause:** known or suspected
**Workaround:** concrete steps
**Tracking:** issue link or TODO
```

Statuses: `[OPEN]`, `[INVESTIGATING]`, `[MITIGATED]`, `[RESOLVED]`.

---

## Open issues

### [OPEN] flash-ps1 screenshots pending first public release build
**Affects:** documentation only
**Symptom:** `docs/src/images/flash-ps1-running.png` and
`docs/src/images/flash-ps1-success.png` are referenced in
`installing-and-booting.md` but the actual screenshots have not been
captured yet (`.gitkeep` placeholders exist).
**Cause:** Screenshots require a real Windows machine running
`flash.ps1` against a release ISO.
**Workaround:** None needed — the guide text is complete; images will
be added during release QA.
**Tracking:** placeholder for issue

### [OPEN] Ollama CPU-only slow on low-core systems
**Affects:** all versions, AMD64 & ARM64, systems with ≤4 CPU cores
**Symptom:** First-token latency over 30s, sustained throughput under
1 token/sec on 7B+ models.
**Cause:** CPU inference is memory-bandwidth- and core-count-limited.
Not a bug — a physical constraint.
**Workaround:** Use smaller / more aggressively
[quantized](reference/glossary.md#quantization) models (e.g. 3B Q4), reduce
context length, close background apps, or add a supported GPU.
**Tracking:** TODO — add recommended-model matrix to
[docs/models.md](models.md).

### [OPEN] Firefox policy file requires restart after persistence unlock
**Affects:** all versions
**Symptom:** Firefox ignores persisted preferences (homepage,
extensions) on the first launch after unlocking persistence.
**Cause:** The policy file is bind-mounted after Firefox's profile
scan on early boot.
**Workaround:** Quit and relaunch Firefox once after unlocking
persistence. See [docs/troubleshooting.md](advanced/troubleshooting.md#firefox-policy).
**Tracking:** TODO — reorder unlock hook in initramfs.

### [OPEN] Some UEFI firmwares don't detect ISO hybrid boot
**Affects:** all versions, certain older UEFI implementations (observed
on some 2014–2017 laptops and a few industrial boards)
**Symptom:** USB stick not listed in boot menu, or listed but fails
with "no bootable device."
**Cause:** Inconsistent firmware handling of `xorriso` hybrid MBR/GPT
images.
**Workaround:** Re-flash with the dedicated `.img` variant (if
published) or use `dd` rather than graphical tools; disable Secure Boot
and CSM toggles; try another USB port (USB 2.0 often works when 3.0
does not).
**Tracking:** TODO — ship a pure-GPT variant.

### [OPEN] Waybar Ollama status widget flicker
**Affects:** recent versions with Waybar integration
**Symptom:** Ollama status icon in the Waybar panel flashes between
states once per poll interval.
**Cause:** Widget polls `ollama ps` and redraws unconditionally, even
when state hasn't changed.
**Workaround:** Increase the poll interval in the Waybar config, or
disable the widget. Cosmetic only.
**Tracking:** TODO — diff state before redraw.

### [OPEN] Monero initial sync time on live sessions without persistence
**Affects:** all versions
**Symptom:** Monero wallet refuses to show balance or takes many hours
to become usable in an amnesic session.
**Cause:** The chain must sync from genesis each boot without
persistence.
**Workaround:** Enable [persistence](reference/glossary.md#persistence) and
persist the Monero data directory; or use a remote node (understanding
the privacy trade-off); or run a pruned node.
**Tracking:** TODO — document remote-node option in
[docs/crypto.md](usage/crypto.md).

---

## Resolved issues

Use this section for issues that have shipped fixes, so users on older
releases can find workarounds.

### [RESOLVED] Template entry
**Affects:** (versions where the bug existed)
**Symptom:** (what users saw)
**Cause:** (root cause)
**Fix:** (released in vX.Y.Z — link commit or PR)
**Workaround for older versions:** (if applicable)

---

## Reporting new issues

If you hit something not listed here:

1. Search the GitHub issue tracker first.
2. If it's new, open an issue with:
   - PAI version and architecture (AMD64 / ARM64)
   - Hardware (model, CPU, GPU if relevant)
   - Exact symptom and reproduction steps
   - Whether persistence was enabled
3. For urgent or security-sensitive issues, follow
   [SECURITY.md](security.md) instead of the public tracker.

See [SUPPORT.md](SUPPORT.md) and [CONTRIBUTING.md](https://github.com/nirholas/pai/blob/main/CONTRIBUTING.md) for
more.
