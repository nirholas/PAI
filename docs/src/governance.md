---
title: Governance
---

This document describes how PAI is governed today and how that may evolve.
It is meant to be honest, not aspirational.

---

## 1. Current State

PAI operates under a **benevolent-dictator** model. There is one maintainer:

- **[@nirholas](https://github.com/nirholas)** — sole maintainer, has final
  say on all decisions.

This reflects reality: PAI is a young project with one primary author. The
structure below exists to make the path toward a multi-maintainer model
explicit, not to pretend the project is already there.

---

## 2. Decision-Making

**Day-to-day changes** (bug fixes, docs, small features) use **lazy
consensus**: if a PR sits open for 72 hours with no blocking objection from
the maintainer, it can be merged.

**Architectural changes, security-posture changes, and governance changes**
require an explicit approval comment from the maintainer before merging.

The maintainer may veto any change without justification, but should provide
a reason as a courtesy to contributors.

---

## 3. How Decisions Are Recorded

Significant decisions — anything that changes architecture, security posture,
or governance itself — are recorded as **Architecture Decision Records** in
[`/docs/adr/`](adr/). ADR format:

```
docs/adr/NNNN-<slug>.md
```

The ADR index lives at [`docs/adr/README.md`](adr/README.md). When in
doubt, write an ADR: it is cheaper than relitigating the decision later.

---

## 4. Becoming a Maintainer

There is no application process. Maintainership is earned by:

1. **Sustained contribution** — meaningful PRs merged over at least 3 months.
2. **Demonstrated judgment** — good PR reviews, constructive issue triage,
   solid build-script hygiene.
3. **Nomination** — an existing maintainer proposes the candidate in a
   GitHub discussion.
4. **Lazy-consensus approval** — no blocking objection from existing
   maintainers within 7 days.

Maintainers get write access to the repository and co-ownership of the
release signing key.

---

## 5. Removing a Maintainer

- **Inactivity (6+ months with no meaningful contribution):** The maintainer
  is moved to Emeritus status after a private notice and a 30-day grace
  period.
- **Code of Conduct violation:** Immediate removal by the remaining
  maintainers (or by @nirholas while sole maintainer), with no grace period.
  The removed maintainer may appeal privately.

Emeritus maintainers retain credit in [`MAINTAINERS.md`](MAINTAINERS.md)
but lose write access and release-signing rights.

---

## 6. Forks and Hard Disagreements

PAI is released under the [GNU General Public License v3](https://github.com/nirholas/pai/blob/main/LICENSE). Forking
is explicitly permitted and carries no stigma. If the project's direction
does not serve your needs, a fork is the correct remedy — that is by design.

If you disagree with a decision, the preferred path is: open a GitHub
Discussion, make your case, and accept the outcome. Persistent lobbying on
closed issues is not productive.

---

## 7. Funding and Finances

PAI accepts voluntary donations to support hosting, signing-key
infrastructure, and maintainer time.

| Channel | Address / link |
|---|---|
| GitHub Sponsors | *not yet enabled — tracked in [ROADMAP.md](roadmap.md) Phase 2 · Governance* |
| Bitcoin | *address published with first signed release once the signing key exists* |
| Monero | *address published with first signed release once the signing key exists* |

Until those channels are live, PAI receives zero donations — the
project pays its own way on free-tier infrastructure (GitHub, Cloudflare
Pages, community-donated build minutes). Do not send funds to any
address claiming to be PAI's until this table lists a verified link
with a PGP-signed announcement on the releases page.

**How funds are used:** Infrastructure costs first (CI, hosting, domain),
then maintainer time for security-critical work. Any disbursement above
$100 will be posted publicly in a pinned GitHub Discussion.

*This section will be updated as donation infrastructure is set up.*

---

## 8. Evolving This Document

Amendments to `GOVERNANCE.md` must go through an ADR
([`docs/adr/`](adr/)). The ADR should describe what is changing, why,
and what the new text will be. The current maintainer must explicitly approve.

---

*See also: [`CONTRIBUTING.md`](https://github.com/nirholas/pai/blob/main/CONTRIBUTING.md) · [`MAINTAINERS.md`](MAINTAINERS.md) · [`CODE_OF_CONDUCT.md`](https://github.com/nirholas/pai/blob/main/CODE_OF_CONDUCT.md)*
