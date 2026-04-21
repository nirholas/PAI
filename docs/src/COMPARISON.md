# Comparison

> **These are neighbors, not rivals.** Each of the projects below serves
> a different purpose and a different threat model. Pick the one that
> matches what you are actually trying to protect against. In many
> cases, the right answer is to use two of them together.

PAI occupies a specific niche and owns it: **offline, local AI on a disposable, private, portable boot medium.** No other live-OS project ships a curated local-LLM stack, GPG, and cold-signing tooling out of the box. That's PAI's lane, and it runs it well.

PAI is not trying to replace Tails, Whonix, Qubes, Kodachi, or Debian Live — each of those is better than PAI at the problem it was built to solve. The right mental model is a toolkit: pick the tool that matches what you are actually defending against, and use two of them together when the job calls for it.

---

## At a glance

| Dimension | Tails | Whonix | Qubes OS | Kodachi | Debian Live | **PAI** |
|---|---|---|---|---|---|---|
| **Primary goal** | Anonymous internet use | Anonymous networking via Tor gateway | Security by compartmentalization | Privacy-focused live OS with anonymity tooling | General-purpose live Debian | Offline, local AI on portable medium |
| **Threat model focus** | Network observation, leaving traces on host | Application deanonymization, IP leaks | Cross-domain compromise, malware containment | Network surveillance, local tracing | N/A (general use) | Cloud dependence, data exfiltration, host entanglement |
| **Persistence default** | Off (optional encrypted persistence) | On (VM disks persist) | On (per-VM) | Off (optional persistence) | Off | Off (optional encrypted persistence) |
| **Network default** | Everything routed through Tor | Everything routed through Tor gateway | Per-VM (configurable) | Tor/VPN by default | Direct | **Offline by default**; explicit opt-in for network |
| **Local LLMs out of the box** | No | No | No | No | No | **Yes (Ollama + curated models)** |
| **Crypto wallets included** | No (user installs) | No (user installs) | No (user installs) | Yes (several) | No | Yes (curated set) |
| **Host isolation strength** | High (amnesic live boot) | Very high (VM + gateway separation) | Very high (Xen-based compartments) | Medium–high (live boot) | Low–medium (live boot) | High (amnesic live boot) |
| **Resource footprint** | Light | Heavy (two VMs) | Very heavy (Xen + many VMs) | Medium | Light | Medium–heavy (depends on model size) |
| **Learning curve** | Low | Medium | High | Low–medium | Low | Low–medium |
| **Maintenance model** | Debian-based, non-profit, frequent releases | Community + Freedom of the Press Foundation | Invisible Things Lab + community | Small team | Debian project | Community, Debian-based |

> Notes on the non-PAI columns: these are general-knowledge summaries
> written in good faith, not audits. They may be out of date or miss
> nuance. **Please open a PR if you maintain one of these projects and
> something is wrong — we will fix it happily.** Entries about other
> projects should be read with a *(verify)* in mind.

---

## When to pick PAI vs …

### vs Tails

Pick **Tails** if your primary need is to use the internet without being
observed — to browse, communicate, or publish in a way that resists
network-level correlation. Tails has spent more than a decade hardening
that use case and it is the right tool for it.

Pick **PAI** if your primary need is to *think* on a machine without
that thinking being harvested, and if most of what you want to do can
happen offline. PAI's defining feature is a local LLM that works with
the network cable unplugged. Many users will want both sticks.

### vs Whonix

Pick **Whonix** if your threat model centers on application-level
deanonymization — if a single leaking app would ruin your day, and you
want the mathematical guarantees of a Tor-gateway architecture. Whonix
is unusually serious about this problem.

Pick **PAI** if you are not primarily trying to hide an IP address and
you want a simpler, lighter setup focused on keeping your data on your
own medium. PAI does not route traffic through Tor by default; it
avoids the network entirely by default.

### vs Qubes OS

Pick **Qubes** if you need strong isolation between different parts of
your digital life on one machine — work, personal, banking, research —
and you have the hardware and patience for its learning curve. Qubes is
the gold standard for security-by-compartmentalization.

Pick **PAI** if you want a portable, minimalist environment you can
carry between machines, and you do not need Qubes-grade compartmentation
because the boot medium itself is your compartment. PAI is something
you put in a drawer; Qubes is something you live in.

### vs Kodachi

Pick **Kodachi** if you want a polished, feature-rich live OS with a
lot of anonymity tooling built in and you are comfortable with its
defaults. It covers a lot of ground out of the box.

Pick **PAI** if you prefer a minimal, auditable base focused on one
thing — local AI — rather than a broad suite. PAI ships fewer tools on
purpose; fewer defaults to understand, fewer surfaces to trust.

### vs Debian Live

Pick **Debian Live** if you want a general-purpose live system with no
particular opinion about what you do with it. It is an excellent
foundation for building your own thing.

Pick **PAI** if you want that same Debian base, but pre-configured for
offline AI work, with curated models, wallets, and privacy defaults
already in place. PAI is, in a sense, Debian Live with opinions.

---

## Corrections welcome

If you maintain or actively use one of these projects and you think our
summary is unfair, incorrect, or out of date, please open a pull
request. We would much rather be accurate than flattering to ourselves.
No project in this document is an enemy. We are all, in our own ways,
trying to make computers serve the people holding them.
