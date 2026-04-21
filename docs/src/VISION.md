# Vision

> Related: [STRATEGY.md](STRATEGY.md) · [ROADMAP.md](roadmap.md) · [CHANGELOG.md](CHANGELOG.md)

PAI is a private, offline AI workstation you can carry in your pocket,
that leaves no trace.

## 1. The world we want

A world where running your own intelligence is as normal as running your
own notebook. Where a question asked of a machine stays between you and
the machine. Where privacy is the default, not a premium add-on, not a
checkbox buried three menus deep, not a feature gated behind a
subscription.

We want the act of thinking with a computer to be as ordinary, as
unlogged, and as unsurveilled as thinking with a pen.

## 2. Why a USB stick?

- **Portability.** Your workstation fits on a keychain. It boots on any
  reasonably recent x86_64 or ARM64 machine you can find.
- **Plausible deniability.** When unplugged, there is no PAI on the host.
  No installer, no registry key, no shell history, no swap footprint.
- **Separation from the host.** The host's compromised OS cannot read
  what the stick never writes to it.
- **No-install onboarding.** `dd` an image, boot, work. No accounts. No
  cloud. No "welcome" email.
- **Recoverability.** Lose the stick, rebuild from a signed image in
  under ten minutes. The stick is the artifact; you are not locked in.

## 3. Why local AI?

- **Sovereignty.** The model runs on hardware you control. Prompts and
  outputs never leave the device unless you send them.
- **Latency.** No round trip. No rate limit. No outage on someone else's
  status page.
- **Cost.** Once the hardware exists, inference is free at the margin.
- **Uncensored research.** Journalists, researchers, and students can
  query freely without a third party filtering, logging, or reporting.
- **Hostile networks.** Works on a plane, in a blackout, in a country
  whose network you do not trust, in a building whose Wi-Fi you do not
  trust.

## 4. The 10-year picture

Every curious person owns a PAI stick the way they own a notebook.
Models small enough to run on a $50 single-board computer answer daily
questions — translation, summarisation, code, search over personal
notes — with no network involved. Schools hand them out. Libraries lend
them. Newsrooms issue them to field reporters. The default assumption
of "AI" is local, private, and yours.

The cloud remains useful for frontier-scale work. It is no longer the
only path to intelligence.

## 5. What we will never do

- Ship telemetry. Not anonymised, not aggregated, not "opt-out by
  default." None.
- Add backdoors, key escrow, or "lawful access" hooks. A private tool
  with a master key is not a private tool.
- Sell user data. We do not collect it; there is nothing to sell.
- Gate core functionality behind a paid tier. The default boot must
  always be fully capable.
- Enter partnerships — commercial, governmental, or otherwise — that
  compromise any of the above.

If the project is ever pressured to break these commitments, the
correct response is to fork, document, and walk away. The mission
outlives the maintainers.
