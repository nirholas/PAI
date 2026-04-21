# Cloud build infrastructure — operational notes

This doc covers the **actual** PAI build VMs as they exist in Google Cloud today.
It is the authoritative reference for starting, stopping, resizing, resuming, and
billing-hygiene on the builders. For a more general "how to build PAI in the
cloud from scratch" walkthrough, see [build-in-cloud.md](build-in-cloud.md).

## Project & account

- **Project**: `<your-gcp-project>` — substitute your own GCP project ID below.

## Instances

| Name | Zone | Arch | Machine type | Boot disk | Purpose |
|---|---|---|---|---|---|
| `pai-builder` | `us-central1-a` | amd64 | `n2-highcpu-96` (96 vCPU / 96 GB) | 200 GB pd-ssd | Debian live-build for x86_64 ISO |
| `pai-builder-arm` | `us-central1-f` | arm64 | `t2a-standard-48` (48 vCPU / 192 GB) | 200 GB pd-ssd | Debian live-build for aarch64 ISO |

Both have the repo cloned at `~/pai` (arm64 builds from `~/pai/arm64/`).

## Auth (every fresh shell / codespace)

Codespaces / new shells lose gcloud auth. Re-auth:

```bash
gcloud auth login                          # follow the URL, paste verifier
gcloud config set project <your-gcp-project>
```

Sanity check:

```bash
gcloud compute instances list              # should show both builders
```

If the above fails with `ACCESS_TOKEN_SCOPE_INSUFFICIENT`, also run
`gcloud auth application-default login`.

## Stop / start (free tier while stopped)

**You are billed for a running VM, but NOT for a stopped VM** — boot disks still
incur small storage cost (~$0.04/GB/month). Always stop when idle.

```bash
# Stop both at end of a session
gcloud compute instances stop pai-builder     --zone=us-central1-a
gcloud compute instances stop pai-builder-arm --zone=us-central1-f

# Start when you need to build again
gcloud compute instances start pai-builder     --zone=us-central1-a
gcloud compute instances start pai-builder-arm --zone=us-central1-f
```

Startup takes ~30 seconds. All files under `/home/codespace` are preserved
across stop/start (persistent boot disk).

## Resize the machine type

Must be stopped first. Keep machine-family compatible if you can (e.g. n2 → n2),
otherwise some cross-family moves fail because of disk/CPU-platform constraints.

```bash
gcloud compute instances stop pai-builder --zone=us-central1-a
gcloud compute instances set-machine-type pai-builder \
    --zone=us-central1-a --machine-type=n2-highcpu-96
gcloud compute instances start pai-builder --zone=us-central1-a
```

Quota reality: C3_CPUS default quota in `us-central1` is **24** (blocks
large C3 SKUs without a quota increase request). N2_CPUS is **200** — plenty
of headroom for n2-highcpu-96. C3D is **0** (not approved yet). C4A (ARM Axion)
requires hyperdisk-balanced boot disks; t2a is the only option for our pd-ssd
boot disk.

## Kicking off a build

The repo on each builder lives at `~/pai`. The amd64 build runs from the repo
root; the arm64 build runs from `~/pai/arm64/`.

```bash
# amd64
gcloud compute ssh pai-builder --zone=us-central1-a --command="\
    cd ~/pai && sudo rm -rf chroot cache binary .build *.iso build.log; \
    (nohup sudo bash build.sh > ~/build.log 2>&1 &)"

# arm64
gcloud compute ssh pai-builder-arm --zone=us-central1-f --command="\
    cd ~/pai/arm64 && sudo rm -rf chroot cache binary .build *.iso build.log; \
    (nohup sudo bash build.sh > ~/build.log 2>&1 &)"
```

Runs detached (no SSH tunnel needed while it runs). On the current SKUs a full
build takes roughly **25–30 min**. Tail progress:

```bash
gcloud compute ssh pai-builder --zone=us-central1-a --command='sudo tail -f /home/codespace/build.log'
```

## Syncing a local repo into the builder

When iterating, tar the needed subtree and stream it in over SSH:

```bash
tar -cz --exclude='.git' --exclude='chroot' --exclude='cache' \
        --exclude='binary' --exclude='*.iso' \
        config branding build.sh \
| gcloud compute ssh pai-builder --zone=us-central1-a \
        --command="cd ~/pai && tar -xzf -"
```

For arm64 swap the tar args to `arm64 branding` and target `pai-builder-arm`.

## Pulling finished ISOs

```bash
gcloud compute scp --zone=us-central1-a \
    pai-builder:/home/codespace/pai/live-image-amd64.hybrid.iso \
    /tmp/pai-0.1.0-amd64.iso

gcloud compute scp --zone=us-central1-f \
    pai-builder-arm:/home/codespace/pai/arm64/live-image-arm64.hybrid.iso \
    /tmp/pai-0.1.0-arm64.iso
```

## Publishing downloads

ISOs are served from Cloudflare at `https://get.pai.direct/`. Upload finished
artifacts to the Cloudflare origin (R2 / Pages) — see internal ops notes for
the exact bucket and credentials (not committed). Do not republish via GCS.

## Resuming from a cold start (future session checklist)

1. `gcloud auth login && gcloud config set project <your-gcp-project>`
2. `gcloud compute instances list` — confirm both VMs exist and note their status
3. If `TERMINATED`: `gcloud compute instances start pai-builder …` (both zones)
4. Wait ~30s, then either SSH in or run a build via the commands above
5. When done: `gcloud compute instances stop …` on both (don't forget)

## Cost notes

- n2-highcpu-96 running: ~$2.70/hr → ~$65/day if left on by mistake
- t2a-standard-48 running: ~$1.60/hr → ~$38/day
- Stopped VMs: only disk charges (~$17/month for both 200 GB pd-ssd disks combined)
- ISO hosting is handled by Cloudflare, not GCS — no egress cost from this project

Set a budget alert at
<https://console.cloud.google.com/billing/budgets> if you're worried about
forgetting a running VM.
