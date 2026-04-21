# Building PAI in the Cloud

Building PAI on a laptop works, but it's slow (15–60 minutes) and disk-hungry (~30 GB for minimal, ~80 GB for full). If you're iterating on a **custom flavor** — extra packages, a different desktop, pre-bundled models, ARM64 cross-builds — a high-powered cloud VM pays for itself in saved time.

This guide focuses on **Google Cloud**, which gives new accounts **$300 in free credits** valid for 90 days. That's enough to run a 32-vCPU builder for roughly **190 hours** — more ISO builds than any sane person needs.

---

## Why cloud build?

| | Laptop (8 vCPU) | GCP `n2-standard-32` |
|---|---|---|
| Minimal ISO build | 15–25 min | **3–4 min** |
| Full ISO build | 45–60 min | **8–12 min** |
| Disk I/O | Thermal-throttled SSD | pd-ssd, no throttling |
| Cost per build | Your fan | ~$0.10 |
| Parallel flavors | One at a time | Spin up N VMs |

The sweet spot is iterating on a custom flavor: edit a hook, kick off a build, have an ISO in 4 minutes, flash to a test USB, repeat.

---

## Google Cloud (recommended — $300 free credits)

### 1. Sign up and claim credits

- Sign up at [cloud.google.com/free](https://cloud.google.com/free)
- New accounts get **$300 in credits** valid for 90 days
- A credit card is required for identity verification, but nothing is charged until you explicitly upgrade

### 2. Install the `gcloud` CLI

- macOS: `brew install --cask google-cloud-sdk`
- Linux: [cloud.google.com/sdk/docs/install](https://cloud.google.com/sdk/docs/install)
- Then: `gcloud init` and pick your new project

### 3. Create the build VM

```bash
gcloud compute instances create pai-builder \
  --machine-type=n2-standard-32 \
  --image-family=debian-12 --image-project=debian-cloud \
  --boot-disk-size=200GB --boot-disk-type=pd-ssd \
  --zone=us-central1-a
```

Machine type cheat sheet:

| Type | vCPUs | RAM | ~$/hr | Best for |
|---|---|---|---|---|
| `e2-standard-8` | 8 | 32 GB | ~$0.27 | Casual minimal builds |
| `n2-standard-16` | 16 | 64 GB | ~$0.77 | Full builds, good balance |
| `n2-standard-32` | 32 | 128 GB | ~$1.55 | Fastest iteration loop |
| `c3-highcpu-44` | 44 | 88 GB | ~$2.10 | CPU-bound package installs |

For one-off builds, `e2-standard-8` is fine. For flavor development (many builds/day), pay for the bigger box — your time is worth more than the credits.

### 4. Build the ISO

```bash
gcloud compute ssh pai-builder --zone=us-central1-a

# Inside the VM:
sudo apt update && sudo apt install -y docker.io git
sudo usermod -aG docker $USER && newgrp docker

git clone https://github.com/nirholas/pai.git
cd pai

# Optional: edit hooks or package lists for your custom flavor
# vim config/package-lists/pai.list.chroot

docker build -f Dockerfile.build -t pai-builder .
docker run --privileged --rm -v "$PWD/output:/output" pai-builder

ls -lh output/*.iso
```

### 5. Pull the ISO back

```bash
# From your local machine:
gcloud compute scp pai-builder:~/pai/output/live-image-amd64.hybrid.iso . \
  --zone=us-central1-a
```

### 6. Delete the VM — don't forget this

```bash
gcloud compute instances delete pai-builder --zone=us-central1-a
```

A running `n2-standard-32` burns ~$37/day. Even with $300 in credits, leaving one idle for a week eats most of it. **Always delete when done.**

Set a budget alert at [console.cloud.google.com/billing/budgets](https://console.cloud.google.com/billing/budgets) for peace of mind.

---

## Alternatives

### AWS (EC2)

New accounts get a 12-month free tier, but it doesn't include build-grade machines. Expect to pay out-of-pocket. A `c7i.8xlarge` (32 vCPU, 64 GB) is ~$1.45/hr and performs similarly to `n2-standard-32`.

```bash
# Rough equivalent — assumes you already have an AWS CLI profile and a key pair
aws ec2 run-instances \
  --image-id ami-0fa1de1d60de6a97e \   # Debian 12 AMD64 us-east-1
  --instance-type c7i.8xlarge \
  --key-name YOUR_KEY \
  --block-device-mappings 'DeviceName=/dev/xvda,Ebs={VolumeSize=200,VolumeType=gp3}'
```

### Azure

New accounts get **$200 in credits** for 30 days. A `Standard_D32s_v5` (32 vCPU, 128 GB) is ~$1.54/hr.

### Hetzner / OVH / self-hosted

Hetzner's `CCX63` (48 dedicated vCPU, 192 GB) is **€0.30/hr** — dramatically cheaper than hyperscalers for throwaway build boxes. No free credits, but no egress fees either.

---

## Tips for custom flavors

1. **Cache your Docker layers.** The `pai-builder` image takes ~5 min to build the first time. Keep the VM alive across iterations and only rebuild the image when `Dockerfile.build` changes.
2. **Mount a persistent disk for `/output` and the git clone.** Destroying the VM while keeping the disk means you can resume in seconds next session.
3. **Use `docker run --rm` with bind mounts** so ISOs land on the host filesystem and survive container exits.
4. **Build both architectures in parallel.** Spin up one VM for AMD64 and one for ARM64 (`t2a-standard-32` on GCP) and let them run simultaneously.
5. **Stream the ISO straight to a machine for testing** instead of downloading locally:
   ```bash
   gcloud compute ssh pai-builder --zone=us-central1-a -- \
     'cat ~/pai/output/live-image-amd64.hybrid.iso' \
     | sudo dd of=/dev/sdX bs=4M status=progress && sync
   ```

---

## Cost reality check

At current GCP pricing, **one full ISO build on `n2-standard-32` costs about $0.10**. Even doing 10 builds a day while developing a custom flavor, you'll burn through maybe $5 of your $300 credit budget in a week. You would have to actively try to run out.

The real cost risk is leaving an idle VM running. Always `gcloud compute instances delete` when you're done, or use a **preemptible/spot** instance (`--provisioning-model=SPOT`) which is ~70% cheaper and auto-terminates within 24 hours.

---

## See also

- [README — Build from Source](../README.md#build-from-source)
- [Customizing the build](../README.md#customizing-the-build)
- [GCP Free Tier details](https://cloud.google.com/free/docs/free-cloud-features)
