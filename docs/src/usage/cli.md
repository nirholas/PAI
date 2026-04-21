---
title: CLI Reference
description: Compact, searchable command reference for PAI — Ollama, model manager, persistence, Tor, networking, wallets, build, diagnostics.
audience: all
sidebar_order: 3
---

# CLI Reference

Scannable command reference. Each entry is a one-liner description
followed by the canonical invocation and one concrete example. For
narrative guides see [basic.md](./basic.md) and [advanced.md](./advanced.md);
for system-level tweaks see [configuration.md](../configuration.md).

---

## 1. Ollama

### ollama list
Show locally installed models.
```bash
ollama list
# NAME             ID          SIZE    MODIFIED
# llama3.2:latest  abc123...   2.0 GB  3 days ago
```

### ollama pull
Download a model from the registry.
```bash
ollama pull <model>[:<tag>]
ollama pull llama3.1:8b-instruct-q4_K_M
```

### ollama run
Start an interactive chat with a model, loading it if needed.
```bash
ollama run <model> [prompt]
ollama run llama3.2 "Explain systemd in 3 bullets."
```

### ollama rm
Remove a local model to free disk.
```bash
ollama rm <model>
ollama rm llama3.1:70b
```

### ollama show
Print a model's Modelfile, parameters, or template.
```bash
ollama show --modelfile <model>
ollama show --modelfile llama3.2
```

### ollama create
Build a custom model from a Modelfile.
```bash
ollama create <name> -f <Modelfile>
ollama create terse-llama -f ./Modelfile
```

Common flags: `--verbose` (show load/eval timings),
`--keepalive <dur>` (how long to hold weights in RAM,
e.g. `--keepalive 30m`).

---

## 2. Model manager (PAI-specific)

PAI ships a small wrapper around Ollama for curated model sets. See
[prompts/04-model-manager.md](../../prompts/04-model-manager.md).

### pai-models list
List models from PAI's curated catalog.
```bash
pai-models list
```

### pai-models install
Install a curated bundle (downloads + verifies signatures).
```bash
pai-models install <bundle>
pai-models install writing-assistant
```

### pai-models verify
Re-verify installed models against upstream hashes.
```bash
pai-models verify [--all]
pai-models verify --all
```

### pai-models prune
Remove models not touched in N days.
```bash
pai-models prune --older-than <days>
pai-models prune --older-than 30
```

---

## 3. Persistence

### persistence-setup
Interactive setup for the encrypted persistent volume.
```bash
persistence-setup
```

### persistence unlock
Unlock an existing persistent volume (prompted at boot, but can be
re-run).
```bash
sudo persistence unlock
```

### persistence lock
Lock the persistent volume immediately (umounts + closes LUKS).
```bash
sudo persistence lock
```

### persistence resize
Grow the persistent volume in place.
```bash
sudo persistence resize --to <size>
sudo persistence resize --to 50G
```

### persistence backup
Dump an encrypted tarball of persistent data.
```bash
persistence backup --out <file.tar.age>
persistence backup --out /mnt/usb/pai-$(date +%F).tar.age
```

### persistence verify
Re-check integrity of the persistent filesystem.
```bash
sudo persistence verify
```

---

## 4. Tor

### systemctl status tor
Check whether the Tor daemon is running.
```bash
systemctl status tor
```

### torsocks
Wrap an arbitrary command through the Tor SOCKS proxy.
```bash
torsocks <command> [args...]
torsocks curl https://check.torproject.org
```

### Tor: switch identity (new circuit)
Send NEWNYM to the control port.
```bash
echo -e 'AUTHENTICATE ""\nSIGNAL NEWNYM\nQUIT' | nc 127.0.0.1 9051
```

### Tor: view current circuits
Using `nyx` (ships with PAI):
```bash
nyx
```

---

## 5. Networking

### nmcli
NetworkManager's CLI for Wi-Fi, Ethernet, VPN.
```bash
nmcli device wifi list
nmcli device wifi connect <SSID> password <PASS>
nmcli connection show --active
```

### nmcli: MAC spoof toggle
Randomize hardware address per connection.
```bash
nmcli connection modify <name> 802-11-wireless.cloned-mac-address random
nmcli connection modify home-wifi 802-11-wireless.cloned-mac-address random
```

### ufw status
Show firewall state and rules.
```bash
sudo ufw status verbose
```

### ufw allow / deny
Add a rule.
```bash
sudo ufw allow <port>/<proto>
sudo ufw allow 22/tcp
sudo ufw deny out 25
```

### ufw delete
Remove a rule by number or exact match.
```bash
sudo ufw status numbered
sudo ufw delete 3
```

### ss
Show active sockets.
```bash
ss -tulpn
```

---

## 6. Wallets

### bitcoin-cli
Talk to a running `bitcoind`.
```bash
bitcoin-cli <command> [args...]
bitcoin-cli getwalletinfo
bitcoin-cli -rpcwallet=cold walletprocesspsbt <psbt>
```

### bitcoin-cli: new receiving address
```bash
bitcoin-cli getnewaddress
```

### monero-wallet-cli
Interactive Monero wallet.
```bash
monero-wallet-cli --wallet-file <path>
monero-wallet-cli --wallet-file ~/wallets/daily.mw
```

### monero-wallet-cli: view-only export
```bash
monero-wallet-cli --wallet-file full.mw
# then inside the REPL:
# export_view_key
```

---

## 7. Build

### ./build.sh
Build a PAI image from source.
```bash
./build.sh <edition> <arch>
./build.sh full amd64
```

### ShellCheck
Lint all shell scripts in the repo.
```bash
shellcheck <files...>
find . -name '*.sh' -print0 | xargs -0 shellcheck
```

### make test
Run the repo's test suite (where applicable).
```bash
make test
```

---

## 8. Diagnostics

### journalctl
Query the systemd journal.
```bash
journalctl -u <unit> [-f] [--since <time>]
journalctl -u tor -f
journalctl --since '10 min ago' -p err
```

### dmesg
Kernel ring buffer (hardware, drivers, OOM killer).
```bash
sudo dmesg -T | tail -n 50
```

### ss
Open sockets and listeners (also listed in §5).
```bash
ss -tulpn
```

### iotop
Per-process disk I/O.
```bash
sudo iotop -oPa
```

### htop
Interactive process / CPU / memory viewer.
```bash
htop
```

### free
Memory summary (useful before loading a big model).
```bash
free -h
```

### nvidia-smi / rocm-smi
GPU state, where applicable.
```bash
nvidia-smi
# or on AMD:
rocm-smi
```

---

## See also

- [basic.md](./basic.md) — narrative intro for newcomers.
- [advanced.md](./advanced.md) — workflows that chain these commands.
- [configuration.md](../configuration.md) — making changes stick.
