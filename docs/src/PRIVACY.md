# Privacy Policy

**PAI does not collect, transmit, or store any user data.**

That is the whole promise. The rest of this document explains what that
means in practice, what third parties can still see when you go online
through PAI, and what trade-offs you should be aware of.

See also: [SECURITY.md](security.md) · [ETHICS.md](ETHICS.md)

---

## What we don't collect

The PAI operating system ships with **no** of the following:

- No telemetry of any kind.
- No usage analytics.
- No crash reports.
- No "anonymous" metrics, feature pings, or A/B experiments.
- No automatic update checks that report your version or machine.
- No model-usage statistics — PAI does not count your prompts, tokens,
  sessions, or which models you load.
- No remote logging, no "phone home", no heartbeat.

There is no PAI server that receives data from your device, because there
is no such server at all.

---

## What the official website collects

The website at `pai.direct` is a static site.

- **No analytics** (no Google Analytics, Plausible, Fathom, etc.).
- **No third-party trackers or ad pixels.**
- **No cookies** beyond what is required to render the site.

Standard web-server access logs may be retained by the hosting provider
for operational purposes (abuse handling, capacity planning). These logs
are not used for analytics and are not correlated with PAI installations.

If this ever changes, it will be disclosed here and in the changelog.

---

## What third parties might see

PAI cannot see you — but once you open a network connection, other
parties on the path might see something. Be explicit about this:

- **Debian / package mirrors.** When you update packages, the mirror
  sees your IP (unless you route through Tor) and which packages you
  request. This is true of every Debian-based system.
- **Online LLM providers (opt-in only).** If you explicitly configure
  PAI to use a hosted model (OpenAI, Anthropic, etc.), that provider
  receives your prompts and may retain them under their own policy.
  Local Ollama models are the default; online LLMs are opt-in.
- **Blockchain nodes.** When you broadcast a transaction from a bundled
  wallet, the node you broadcast to sees your IP (unless you route
  through Tor) and the transaction itself. The transaction is, by
  design, public on the chain.
- **Tor directory authorities and relays.** When you use Tor, you reveal
  to your ISP that you are using Tor (unless you use bridges) and to the
  exit relay the unencrypted portion of your traffic.
- **DNS resolvers.** By default PAI uses DNS-over-HTTPS or Tor for DNS
  depending on configuration; the chosen resolver sees the domains you
  query.

Privacy is about understanding who sees what, not pretending nobody does.

---

## Tor usage notes

- **Tor protects metadata, not content.** If you log into a real account
  over Tor, that account is now linkable to that session.
- **Exit-node risk.** The exit relay can see any unencrypted traffic.
  Always prefer HTTPS. Some exits have been caught running active
  attacks on plaintext traffic.
- **Bridges.** If your network actively blocks Tor, or if the mere fact
  that you use Tor is sensitive in your context, use a bridge
  (`obfs4`, `meek`, `snowflake`). Bridges are configured from the Tor
  settings panel.
- **Do not mix identities.** Do not use the same Tor circuit for an
  anonymous identity and a real-name identity. Use *New Identity* in
  the browser between them.

---

## Persistence data

If you enable persistence on your USB stick:

- The persistence partition is encrypted with **LUKS2**.
- Cipher: **AES-256-XTS**.
- Key derivation: **Argon2id**. `pai-persistence setup` invokes
  `cryptsetup luksFormat --pbkdf argon2id` without overriding the
  cost parameters, so `cryptsetup` benchmarks the host at format time
  and picks values that meet or exceed its built-in minimums
  (≈1–2 s derivation on the target hardware, at least 1 GiB of
  memory, and one pass). Run `sudo cryptsetup luksDump
  /dev/<persist-part>` after setup to see the exact `m_cost`,
  `t_cost`, and parallelism values chosen for your device.
- The passphrase is the only factor. There is no recovery key stored by
  the project or anyone else. **If you forget it, the data is gone.**
- Persistence data never leaves the USB stick unless you deliberately
  copy it off.

Files in the non-persistent live session exist only in RAM and disappear
at shutdown.

---

## Right to be forgotten

Because PAI holds no account or server-side record of you, erasure is
physical:

- **No persistence:** power off. The session is gone.
- **With persistence:** overwrite the USB stick. Options include:
  - `shred -vfz -n 3 /dev/sdX` (slow, thorough — not meaningful on SSDs
    or USB flash; use the next option instead),
  - cryptographic erase by destroying the LUKS header
    (`wipefs -a` on the partition), or
  - simply flash a fresh ISO over the stick.
- **Physical destruction** of the USB stick is the strongest guarantee.

We cannot delete data for you because we never had it.

---

## Children

PAI is a security and systems tool. It is not directed at children under
the age of 13, and we do not knowingly tailor any feature for them. If
you are a parent or guardian and believe PAI is being used by a minor in
a context you are concerned about, nothing in PAI will report this to
anyone — the appropriate action is local supervision, not a complaint to
us, because we have no data to act on.

---

*Last reviewed: 2026-04-17.*
