# Philosophy

This is the long-form answer to *why PAI exists*. The short answer lives
in [VALUES.md](VALUES.md). The comparison to neighboring projects lives
in [COMPARISON.md](COMPARISON.md). This document is the worldview behind
both.

---

## 1. The problem

The last few years have been unkind to the idea of a personal computer.
The most useful new capability in computing — large language models —
has arrived almost entirely as a service. A handful of providers operate
the models, set the rules, log the prompts, and decide who gets access.
Users rent intelligence by the token, and in exchange they hand over the
most intimate corpus they have ever produced: their questions.

This is not an accident. Training frontier models is expensive, serving
them requires a datacenter, and the economic gravity pulls everything
toward the cloud. The default assumption in 2026 is that "AI" means
"somebody else's computer thinking about your data." Telemetry,
retention, and subtle dependence follow from that assumption the way
rain follows clouds.

We do not think this is the only possible future. We think it is a
future that happened because the defaults leaned that way, and we think
better defaults are still possible.

## 2. The alternative

Local models are no longer a curiosity. A laptop from the last few years
can run capable 7B–13B parameter models; a desktop with a modern GPU can
run much larger ones. The quality gap between "what fits on your machine"
and "what runs in a datacenter" is still real, but it is narrower every
month, and for the overwhelming majority of everyday tasks — drafting,
summarizing, translating, coding, thinking out loud — local is already
enough.

PAI starts from that observation and asks a simple question: *what is
the shortest path from a blank USB stick to a private, offline,
locally-owned AI workstation?* Not a toy. Not a demo. A real working
environment where your data never leaves the medium in your pocket.

The alternative we want is not anti-cloud. It is *post-cloud-as-default*:
a world where sending your thoughts to someone else's machine is a
choice you make deliberately, for specific tasks, rather than the only
option on the menu.

## 3. Why a live USB

A live USB is an unfashionable form factor, and that is most of why we
like it.

- **Disposability.** When a session ends, it ends. There is no residue
  on the host, no account to close, no cache to clear.
- **Recoverability.** A corrupted session is a reboot, not a reinstall.
  A lost stick is replaceable; a compromised stick is destroyable.
- **Zero-install onboarding.** The user does not have to trust PAI with
  their existing disk, their existing OS, or their existing data.
  Bootable media is the lowest-commitment way to try a serious tool.
- **Plausible separation from the host.** The host's operating system,
  its surveillance, and its corporate policies are not running when
  PAI is. That is not absolute isolation — firmware and hardware still
  matter — but it is a meaningful boundary.
- **A physical object.** There is something clarifying about a privacy
  tool you can hold. You know where it is. You know when it is plugged
  in. You can give it to someone. You can throw it in a river.

Installation, by contrast, entangles. The moment a privacy tool lives on
your main disk, it shares a fate with everything else on that disk: the
same firmware, the same recovery partitions, the same forensic surface.
Live media sidesteps that entanglement by design.

## 4. Why open source

Privacy tools that are not open source are not privacy tools. They are
promises.

We do not think closed-source vendors are necessarily dishonest. We
think it is structurally impossible for a user to verify a privacy
claim they cannot read. When the threat model includes the vendor —
and for a serious privacy tool it must — source availability stops
being a preference and becomes a precondition.

Everything in PAI is auditable: the build scripts, the package list,
the defaults, the hooks. If a future maintainer ever adds telemetry,
it will be visible in a diff. That visibility is the entire basis on
which we ask anyone to trust us.

## 5. Why Debian

We chose Debian because Debian is boring in exactly the ways a privacy
tool should be boring.

- **Stability.** Debian Stable changes slowly. Slow is a feature when
  the cost of a regression is a user's privacy.
- **Provenance.** Debian has spent three decades building a package
  archive with signed sources, reproducible-builds infrastructure, and
  a social contract that explicitly prioritizes the user.
- **Breadth.** Almost every tool a privacy-conscious user might want
  already exists as a Debian package, built by someone who is not us.
  We inherit that audit work instead of redoing it.
- **Community.** Debian does not have a single corporate owner whose
  incentives could one day diverge from the project's.

Debian is not perfect, and we are not uncritical. It is, as far as we
can tell, the best substrate currently available for building something
like PAI.

## 6. Why Ollama

Running local models used to be a project. Quantizing weights, wiring
up a runtime, managing GPU memory, exposing an API — each step had its
own friction, and most users gave up before reaching the interesting
part.

Ollama collapsed that friction to a single command. It is not the only
local-model runner, and it may not be the last one we support, but it
is currently the shortest path from "I have a computer" to "I am
talking to a private model running on that computer." Friction is a
privacy vulnerability too: every step a user has to perform to keep
their data local is a step at which they might give up and use the
cloud. Ollama removes enough of those steps that local becomes a
realistic default.

## 7. Why not X

We considered — and respect — several paths we did not take.

- **Nix / NixOS.** Unmatched for reproducibility and configuration
  clarity. The learning curve, tooling ecosystem, and onboarding cost
  are still high for a tool whose target audience includes non-experts.
  We may revisit this.
- **Alpine.** Small, fast, and lovely. The musl ecosystem and the
  comparatively thinner package archive made it a harder base for the
  breadth of applications PAI wants to ship. No disrespect to Alpine —
  it is excellent at what it is for.
- **Fedora.** A strong distribution with a security-conscious culture.
  The faster release cadence and corporate stewardship are a different
  set of tradeoffs than Debian's, not worse ones. Debian's governance
  model fit our values more snugly.
- **A custom distribution.** Tempting, and wrong. Every privacy tool
  that builds its own base from scratch eventually becomes a one-person
  maintenance burden. We would rather stand on Debian's shoulders.

None of these projects are competitors. They are choices other people
made in good faith, and we learn from all of them.

## 8. What we hope to inspire

PAI is a small project with a narrow goal, and we hope it stays that
way. The thing we most want to see is not PAI everywhere — it is more
projects like PAI: small, focused, privacy-first tools that pick one
problem and solve it honestly.

The future we want is not one distribution to rule them all. It is a
thousand little sticks, each doing one thing well, each owned by the
person holding it.

If PAI nudges one person to build the next one, it will have been worth
the work.
