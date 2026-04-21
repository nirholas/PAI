---
title: Advanced Usage
description: Power-user workflows on PAI — larger models, headless SSH, tmux, bridging online LLMs, Tor hidden services, cold signing, custom apps, derivative ISOs.
audience: comfortable-with-linux
sidebar_order: 2
---

# Advanced Usage

If [basic.md](./basic.md) was "I booted PAI," this is "I live in PAI."
Everything here assumes you're comfortable with a shell, know what a
systemd unit is, and don't need hand-holding on file paths. For a
flat command reference see [cli.md](./cli.md); for system-level
tweaks see [configuration.md](../configuration.md).

---

## 1. Running larger models

The default `llama3.2` (3B) is fast but shallow. Real work usually
wants 7B–70B.

### Memory math

Rough rule of thumb for Ollama's GGUF quantizations:

| Param count | Q4_K_M (VRAM/RAM) | Q8_0    | F16     |
|-------------|-------------------|---------|---------|
| 7B          | ~4.5 GB           | ~7.5 GB | ~14 GB  |
| 13B         | ~8 GB             | ~14 GB  | ~26 GB  |
| 34B         | ~20 GB            | ~36 GB  | ~68 GB  |
| 70B         | ~42 GB            | ~75 GB  | ~140 GB |

Multiply by ~1.2 for context window, KV cache, and overhead. If a
model doesn't fit entirely in VRAM, Ollama spills to CPU RAM — still
works, just slower.

### Quantization trade-offs

- **Q4_K_M** — best size/quality ratio for most work. Start here.
- **Q5_K_M / Q6_K** — mild quality bump, ~20–30% more memory.
- **Q8_0** — near-lossless. Use when the model is small enough that
  you can afford the bigger footprint.
- **F16 / BF16** — lossless, for benchmarking or fine-tuning base
  weights. Rarely the right choice for inference.

### Ollama Modelfile overrides

```
FROM llama3.1:8b
PARAMETER num_ctx 8192
PARAMETER temperature 0.3
PARAMETER num_gpu 999
SYSTEM """
You are a terse Linux assistant. Answer in <5 lines unless asked.
"""
```

Build it with `ollama create terse-llama -f ./Modelfile` and run with
`ollama run terse-llama`. See [prompts/04-model-manager.md](../../prompts/04-model-manager.md).

---

## 2. Chaining models with local scripts

The interesting stuff happens when you pipe models together. Ollama's
`/api/generate` endpoint returns JSON, which `jq` loves.

```bash
#!/usr/bin/env bash
# Summarize every .md file in a directory, one by one.
for f in "$1"/*.md; do
  echo "=== $f ==="
  ollama run llama3.2 "Summarize in 3 bullets:\n\n$(cat "$f")"
done
```

For structured output:

```bash
curl -s http://localhost:11434/api/generate -d '{
  "model": "llama3.2",
  "prompt": "Return JSON with keys {title,tags[]} for: Why DNS is hard.",
  "format": "json",
  "stream": false
}' | jq -r '.response | fromjson | .tags[]'
```

Two models can talk to each other — one generates, another critiques.
Keep an eye on runaway loops (add a turn counter).

---

## 3. Using PAI headless

PAI is perfectly usable as a headless AI box. See
[prompts/28-ssh-remote-access.md](../../prompts/28-ssh-remote-access.md).

1. Enable the SSH service: `sudo systemctl enable --now sshd`.
2. Drop your public key into `~/.ssh/authorized_keys` (persist it!).
3. From elsewhere: `ssh pai@<lan-ip>`.

Typical flow:

```bash
# Pull a model on the PAI box
ssh pai@10.0.0.42 'ollama pull llama3.1:70b'

# Run a prompt from your laptop, stream back
ssh pai@10.0.0.42 'ollama run llama3.1:70b' <<< "Design a CRDT for shopping lists."

# Sync a generated artifact back
rsync -avz pai@10.0.0.42:~/outputs/ ./outputs/
```

Restrict SSH to LAN in UFW:

```bash
sudo ufw allow from 10.0.0.0/24 to any port 22
sudo ufw deny 22
```

---

## 4. Multi-session workflows

Long-running generations should not die with your terminal.

- **tmux**: `tmux new -s ai`, detach with `Ctrl+b d`, reattach with
  `tmux attach -t ai`. PAI ships with a sensible `~/.tmux.conf` —
  persist it if you customize.
- **Workspaces**: keep editor on 1, model REPL on 2, logs on 3. Sway
  remembers assignments; pin them with `assign` rules in
  `~/.config/sway/config`.
- **systemd user units**: for jobs you want restarted on login, drop
  a unit into `~/.config/systemd/user/` and `systemctl --user
  enable --now <name>`.

For truly long jobs, combine `tmux` + `nohup` + a file log:

```bash
nohup ollama run llama3.1:70b < prompt.txt > out.log 2>&1 &
```

---

## 5. Bridging online LLMs

Sometimes you need Claude or GPT for a specific task. PAI lets you do
this deliberately instead of accidentally.

> **Warning.** The moment you hit an online API, your prompt leaves
> the device. Anything sensitive — keys, seeds, private code, client
> data — should never touch an online model. PAI's firewall is strict
> by design; bypassing it is a choice you make per-task.

### Temporary egress

```bash
# Open outbound HTTPS for the current shell only
sudo ufw allow out 443 comment 'temp-llm-bridge'
export ANTHROPIC_API_KEY="sk-ant-..."   # from your password manager
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-opus-4-7","max_tokens":512,"messages":[{"role":"user","content":"hi"}]}'

# Close it again when done
sudo ufw delete allow out 443
```

For repeated use, a dedicated user account with its own UFW rules is
cleaner than toggling global egress. See
[configuration.md](../configuration.md) for per-uid firewalling.

---

## 6. Tor advanced

### Hidden services

Host a `.onion` service from PAI:

```
# /etc/tor/torrc
HiddenServiceDir /var/lib/tor/my_service/
HiddenServicePort 80 127.0.0.1:8080
```

`sudo systemctl restart tor`, then read the onion address from
`/var/lib/tor/my_service/hostname`. Persist that directory or you'll
get a new address every boot.

### `.onion` bookmarks

The hardened browser ships with a bookmarks folder for common onion
services (SecureDrop, OnionShare, mirrors). Persist your browser
profile to keep your own additions.

### Stream isolation

Different destinations shouldn't share a Tor circuit. Use distinct
SOCKS ports:

```bash
torsocks --isolate curl https://example.com
```

Or configure `IsolateDestAddr`, `IsolateDestPort`, and
`IsolateSOCKSAuth` in `torrc` for per-app circuits.

---

## 7. Crypto advanced

### Cold signing (Bitcoin PSBT)

1. On an **online** PAI install: construct the unsigned transaction
   as a PSBT with `bitcoin-cli walletcreatefundedpsbt`.
2. Export the PSBT to a USB stick (or QR code).
3. On an **offline** PAI install holding the keys: `bitcoin-cli
   walletprocesspsbt <psbt>` and `finalizepsbt`.
4. Carry the signed PSBT back to the online machine and
   `sendrawtransaction`.

Air-gap the signing machine fully — no Wi-Fi firmware, no Bluetooth,
no tethered phone. `rfkill block all` at boot is a reasonable default.

### Monero view-only wallets

Generate a view-only wallet from your full wallet:

```bash
monero-wallet-cli --generate-from-view-key view-only.wallet
```

Use the view-only wallet on your daily-driver PAI to check balances
without exposing spend keys. Keep the spend wallet on an offline
install.

### Ethereum and friends

The same pattern applies: keep signing keys offline, build and
broadcast transactions from an online machine. For ERC-20 heavy use,
a hardware wallet plugged into an online PAI is a reasonable
compromise.

---

## 8. Custom apps

Flatpak is the supported path for adding GUI apps without touching
the base image. See [prompts/24-flatpak-appstore.md](../../prompts/24-flatpak-appstore.md).

```bash
flatpak remote-add --if-not-exists flathub \
  https://dl.flathub.org/repo/flathub.flatpakrepo
flatpak install flathub org.signal.Signal
flatpak run org.signal.Signal
```

Persist `~/.var/app/<app-id>/` to keep app data across reboots.

For CLI tools, prefer your user's `~/.local/bin/` or a Nix user
profile — don't mutate `/usr` or you'll lose the change on image
upgrade.

---

## 9. Building a derivative ISO

If you want to ship a customized PAI (rebranded, extra preinstalled
models, custom keybinds), fork the repo and follow:

- [CONTRIBUTING.md](../../CONTRIBUTING.md) — contributor workflow,
  commit conventions, review process.
- `BUILD-FULL-AMD64.md` / `BUILD-FULL-ARM64.md` — step-by-step ISO
  build, including reproducibility checks.

Keep derivative work downstream of upstream releases; don't invent
private patches that prevent users from verifying the image matches
source.

---

## Where to go next

- [cli.md](./cli.md) — every command referenced above in one place.
- [configuration.md](../configuration.md) — persistent tweaks.
- [basic.md](./basic.md) — back to the fundamentals.
