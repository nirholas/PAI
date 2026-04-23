# Security Policy

PAI is a privacy-focused live operating system. Security is not a feature
bolted on — it is the reason the project exists. This document describes
how security updates flow, how to report vulnerabilities, what is in and
out of scope, and — honestly — where PAI's defenses end.

See also: [PRIVACY.md](PRIVACY.md) · [ETHICS.md](ETHICS.md)

---

## Supported versions

PAI follows a rolling minor-release cadence on top of Debian stable.

| Version            | Status              | Fixes provided                          |
| ------------------ | ------------------- | --------------------------------------- |
| Latest minor       | ✅ Full support      | All security fixes, including low/med    |
| Previous minor     | ⚠️ Critical only    | Only critical (CVSS ≥ 9.0) fixes         |
| Older than that    | ❌ Unsupported       | Upgrade to the latest minor              |

Check your running version with `cat /etc/pai-release`.

---

## Reporting a vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

- **Email:** `support@pai.direct` (monitored by the maintainers)
- **PGP fingerprint:** published at <https://pai-os.org/.well-known/security.txt> once the domain is live; until then, contact `support@pai.direct` directly.
- **Acknowledgement window:** within **72 hours**
- **Coordinated disclosure window:** **90 days** from acknowledgement,
  extendable by mutual agreement if a fix requires more time

Please include:

1. A description of the vulnerability and its impact.
2. Steps to reproduce (or a proof-of-concept).
3. Affected versions, if known.
4. Whether you wish to be credited (see Hall of Fame below).

We will confirm receipt, agree on a disclosure timeline, ship a fix, and
publish an advisory. We do not offer paid bounties at this time.

---

## Scope

**In scope**

- The PAI ISO and its build scripts (`build.sh`, the `arm64/` pipeline,
  `scripts/`, `config/`).
- The PAI desktop environment and first-party scripts (`desktop/`,
  `shared/`).
- The PAI installer / flasher (`scripts/flash.sh`).
- The official website (`website/`) and release-signing infrastructure.

**Out of scope (report upstream)**

- Vulnerabilities in **Debian** packages → report to the Debian Security Team.
- Vulnerabilities in **Ollama** → report to the Ollama project.
- Vulnerabilities in the **Tor** client or **Tor Browser** → report to
  the Tor Project.
- Vulnerabilities in Linux kernel, Wayland/Sway, or other upstream
  components → report to the relevant upstream maintainers.

If you are not sure where an issue belongs, email us anyway — we will
help route it.

---

## Hall of Fame

Thanks to researchers who have responsibly disclosed issues in PAI:

<!-- Researchers will be listed here once the first coordinated disclosure lands. -->

*(empty — be the first)*

---

## Threat model summary

The full threat model lives in `docs/src/architecture.md` *(TODO: file
pending)*. Brief recap:

**PAI is designed to defend against:**

- **Local forensic analysis** of the host PC after shutdown — the live
  system leaves no files on the internal disk by default.
- **Passive network observers** on the local link — Tor, UFW defaults,
  and MAC spoofing reduce what a watcher on the same Wi-Fi can learn.
- **Casual anti-virus and EDR on borrowed hardware** — PAI runs entirely
  from RAM / USB and does not touch the internal OS.
- **Upstream telemetry** — no distro analytics, no model-usage pings,
  no crash reporters. See [PRIVACY.md](PRIVACY.md).

**PAI is NOT designed to defend against:**

- **Nation-state-level targeted attacks.** If a well-resourced adversary
  is specifically hunting you, a general-purpose live USB will not be
  enough. Consult a qualified operational-security professional.
- **Firmware implants** in the host machine (UEFI, ME, baseband, HDD
  controllers). PAI cannot see below the OS.
- **Physical coercion** ("rubber-hose cryptanalysis"). A passphrase you
  are forced to reveal protects nothing.
- **Compromised hardware** — keyloggers, tampered USB sticks, screen
  cameras. Trust your hardware before you trust PAI.
- **Malicious models.** PAI runs models you load. A malicious
  fine-tune can produce malicious output; PAI does not vet model weights.

---

## Known weaknesses

We would rather tell you than have you find out the hard way.

- **Cold-boot RAM retention.** Keys and plaintext can survive in RAM for
  seconds to minutes after power-off, longer if the RAM is chilled.
  Enable memory wipe on shutdown (see *Defensive tips*).
- **Ollama has no sandbox.** The model server runs as an ordinary user
  process. A malicious model or prompt-injection that achieves code
  execution in Ollama's context can read anything that user can read.
- **Browser fingerprinting is imperfect.** Even with Tor Browser,
  screen size, fonts, and timing can narrow an anonymity set. Do not
  assume perfect unlinkability.
- **MAC spoofing is best-effort.** Some drivers / firmwares ignore or
  revert requested MAC changes; some Wi-Fi chipsets leak the real MAC
  during association.
- **USB supply chain.** If the USB stick was tampered with before it
  reached you, PAI cannot detect that. Verify the ISO signature and
  flash from a machine you trust.
- **Live persistence is LUKS-protected but single-factor.** The
  passphrase is the only thing between an adversary with the USB and
  your data. Choose a strong one.
- **Wallets on a live OS** are as safe as the OS hosting them. If you
  hold meaningful value, prefer a dedicated hardware wallet.

---

## Defensive tips for users

- **Verify the ISO signature** before flashing. Instructions in
  [README.md](README.md). An unsigned or mismatched ISO is not PAI.
- **Enable full-memory wipe on shutdown.** PAI ships with this available;
  turn it on if you handle sensitive material (at the cost of a slower
  shutdown).
- **Update regularly.** Rolling releases ship security fixes; an ISO
  that has sat in a drawer for a year is a year behind.
- **Use a strong persistence passphrase.** Argon2id protects it, but
  weak passphrases are still weak.
- **Shut down fully (don't hibernate) when leaving the machine.**
- **Treat the host PC as untrusted.** Do not plug the PAI stick into
  an obviously compromised machine and expect magic.
- **Keep your threat model realistic.** PAI raises the cost of casual
  surveillance. It does not make you invisible.

---

*Last reviewed: 2026-04-17.*
