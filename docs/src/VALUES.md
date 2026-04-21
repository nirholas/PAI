# Values

The non-negotiables. Short rules, short reasons. When we have to choose,
these are the choices we have already made.

---

## 1. Privacy is a default, not a feature

Privacy should not require opt-in, expertise, or vigilance. If a user has
to configure something to keep their data on their own machine, we have
already failed. Every default in PAI assumes the user wants to be left
alone, and the burden of proof falls on anything that breaks that
assumption.

## 2. Sovereignty over convenience

It is often easier to offload thinking, storage, and identity to somebody
else's server. PAI refuses that trade by default. A slightly harder
workflow that keeps you in control of your data, your keys, and your
models is worth more than a frictionless workflow that quietly does not.

## 3. Transparency over trust

"Trust us" is not a privacy model. Every line of code, every build step,
every default, and every network call should be inspectable by anyone who
cares to look. We would rather ship an honest limitation than a polished
black box.

## 4. Portability over installation

A tool that lives on a USB stick is a tool you can carry, lend, discard,
or destroy. Installation entangles you with a host machine, its disks,
its firmware, and its history. PAI prefers the boot medium — something
you can hold in one hand and walk away from.

## 5. Reproducibility over speed

A build that nobody can reproduce is a build nobody can audit. We would
rather spend longer producing an image someone else can rebuild
byte-for-byte than ship faster with artifacts only we can vouch for.
Determinism is a form of honesty.

## 6. Minimalism over completeness

Every package we add is an attack surface, a maintenance burden, and a
claim we are making on the user's disk and attention. If a feature does
not serve the core mission — offline, private, portable AI — it does not
belong in the base image. Users can always add more; they cannot easily
remove what we have bundled.

## 7. Honesty over hype

We will not promise anonymity we cannot deliver, security properties we
have not verified, or model capabilities we have not tested. When
something is a best-effort mitigation, we will say so. When something is
out of scope, we will say that too. Hype is a privacy vulnerability: it
makes users relax when they should not.

## 8. Kindness over cleverness

In issues, pull requests, and discussions, the goal is to help people
build and use a privacy tool — not to score points. Clever dunks drive
away the exact users and contributors we most want to reach. Patience
with beginners is a feature of the project, not a favor to them.

---

**When values conflict, privacy wins.**
