# PAI Ethics

PAI is a tool. Tools are not neutral. This document states what we will
build, what we will not, and how we think about the line between them.

See also: [SECURITY.md](security.md) · [docs/src/PRIVACY.md](PRIVACY.md) ·
[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

---

## Our position

PAI exists because people have a right to compute privately. A bootable
USB that runs a capable AI model without network dependency, telemetry,
or account login restores a default that commercial AI has removed —
the ability to use software without being logged, fingerprinted, or
monetised.

We believe this default is worth defending for everyone: journalists,
dissidents, researchers, patients, lawyers, students, and ordinary
people who simply want their private thoughts to remain private.

Privacy is not a shield for wrongdoing. It is a precondition for
autonomy, dignity, and free thought. PAI is built on that premise.

---

## What PAI is designed for

- **Private research, writing, and thinking** — using AI without a
  third party recording your prompts or a subscription keeping a log.
- **Journalism and source protection** — drafting and analysis on a
  machine that leaves no trace on the host.
- **Operating under surveillance or censorship** — for people who
  cannot use cloud services safely in their jurisdiction.
- **Personal data that should never leave your device** — medical,
  legal, financial, or emotional material that cloud AI would ingest.
- **Offline environments** — field research, travel, air-gapped labs,
  classrooms without reliable connectivity.
- **Learning and experimentation** — running, auditing, and modifying
  AI without platform gatekeepers.

---

## What PAI is not designed for

PAI is general-purpose software under GPLv3. We cannot and will not
police what users do with it. But we can be clear about what the
project is *for*, and what we will not help build.

**We will not build or merge features intended for:**

- **Targeted harassment, stalking, or non-consensual surveillance** of
  any person.
- **Generation or facilitation of child sexual abuse material (CSAM).**
  We will remove and report any such use of project infrastructure.
- **Non-consensual intimate imagery** (deepfake pornography, undressing
  apps, etc.).
- **Large-scale disinformation operations** or automated impersonation
  campaigns intended to deceive at scale.
- **Coordinated fraud, scam automation, or phishing kits.**
- **Credential stuffing, botnets, or other infrastructure for
  unauthorised access** to systems the user does not own.
- **Weapons design** — chemical, biological, radiological, nuclear,
  or autonomous lethal systems.

This is not a list of things the law forbids. It is a list of things
the maintainers will refuse to accept contributions for, and will
remove if they appear.

---

## Dual-use honesty

Most privacy tools are dual-use. Encryption protects both dissidents
and criminals. So does a live-USB operating system. So do local
language models.

We accept this trade-off consciously. The question we ask is not
"can this be misused?" — everything can — but "does the benefit to
legitimate users outweigh the marginal uplift to bad actors, given
that equivalent tools already exist?"

For a private AI USB, the answer is clearly yes. Cloud LLMs are
freely available to anyone with a credit card and a fake email.
PAI does not make bad actors meaningfully more capable; it makes
private, legitimate use *possible* for people who currently have no
option.

---

## Models and weights

PAI ships with, and makes it easy to run, open-weight models from
third parties (currently the Ollama library). We do not vet every
weight. Users should be aware:

- Model outputs can be wrong, biased, or harmful. A local model is
  no more trustworthy than a cloud model by virtue of being local.
- Fine-tuned models published by third parties may encode values
  or capabilities their authors did not disclose.
- PAI provides a runtime, not an endorsement. The choice of model
  is the user's.

We will not ship, and will not make it easier to ship, models whose
explicit purpose is to generate content in the forbidden categories
above.

---

## User responsibility

PAI gives you a capable, offline AI on hardware you control. With
that comes responsibility:

- **You are accountable for what you produce.** "The AI wrote it" is
  not a defence.
- **Local ≠ safe.** Sensitive material on a lost or stolen USB is at
  risk. Use persistence encryption and strong passphrases.
- **Anonymity ≠ invisibility.** PAI raises the cost of casual
  surveillance; it does not make a determined adversary powerless.
- **Your jurisdiction applies.** Some of what PAI makes possible is
  illegal in some countries. We do not advise on that; consult a
  local lawyer.

---

## Maintainer commitments

The PAI maintainers commit to:

1. **Not adding telemetry, analytics, phone-home, or "anonymous usage
   stats"** — ever, regardless of pressure from funders, partners, or
   governments.
2. **Not accepting contributions that backdoor, weaken, or circumvent
   the privacy guarantees** documented in [SECURITY.md](security.md).
3. **Publishing transparency reports** if we ever receive a legal
   request that would compromise users, to the extent allowed by law.
4. **Staying free and open** — PAI will remain GPLv3, with no
   "enterprise edition" that extracts privacy features behind a
   paywall.
5. **Documenting the threat model honestly**, including where PAI
   fails. See [SECURITY.md § Known weaknesses](security.md#known-weaknesses).

---

## Enforcement

If you believe a PAI contribution, release, or maintainer action
violates this document, raise it:

- **Community issue:** via [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
  enforcement channels.
- **Security issue:** via [SECURITY.md](security.md) reporting.
- **Ethics issue:** email the maintainers at `contact@pai.direct`.

We will respond, investigate, and publish a resolution.

---

*Last reviewed: 2026-04-20. This document evolves; pull requests
welcome.*
