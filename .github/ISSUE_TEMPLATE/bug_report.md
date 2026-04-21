---
name: Bug report
about: Report a reproducible problem with PAI
title: "[bug] "
labels: ["bug", "triage"]
assignees: []
---

<!--
Before filing, please read SUPPORT.md and CONTRIBUTING.md.
NEVER attach or paste seed phrases, passphrases, wallet keys, or API tokens.
Redact them from any logs or screenshots before uploading.
-->

## What happened

<!-- Describe the bug in plain prose. -->

## What you expected to happen

<!-- What should have happened instead? -->

## Steps to reproduce

<!-- Minimal, numbered steps. The shorter and more deterministic, the faster we can help. -->

1.
2.
3.

## Environment

- **PAI version** (from `cat /etc/os-release`):
- **Architecture**: <!-- AMD64 / ARM64 -->
- **Hardware make/model**:
- **RAM**:
- **Boot mode**: <!-- UEFI / Legacy BIOS -->
- **Persistence enabled**: <!-- yes / no -->
- **Tor mode**: <!-- on / off -->

## Logs

Attach the following where relevant. **Redact any sensitive data first
— never include seed phrases, passphrases, tokens, or private keys.**

- [ ] `journalctl -k` (kernel log)
- [ ] `dmesg` output
- [ ] Relevant application logs (specify which)
- [ ] Boot log / screenshot of failure

<!-- Paste logs inside <details> blocks or attach as files. -->

## Screenshots

<!-- Optional. Drag & drop images here. Redact anything sensitive. -->

## Additional context

<!-- Anything else that might help: recent changes, related issues, hardware quirks. -->

## Pre-flight checklist

- [ ] I searched [existing issues](../issues?q=is%3Aissue) and found no duplicate
- [ ] I read [SUPPORT.md](../blob/main/SUPPORT.md) and this is a bug, not a support question
- [ ] I have redacted all secrets, seed phrases, passphrases, and tokens from logs and screenshots
- [ ] I followed [CONTRIBUTING.md](../blob/main/CONTRIBUTING.md) guidance for filing reports
