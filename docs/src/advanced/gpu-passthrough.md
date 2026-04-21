---
title: "GPU Passthrough for PAI VMs — NVIDIA and AMD on KVM"
description: "How to pass a discrete GPU from a Linux host to a PAI virtual machine. Covers VFIO, vendor quirks, and the reality on macOS and Windows hypervisors."
sidebar:
  label: "GPU passthrough"
  order: 5
head:
  - tag: meta
    attrs:
      property: "og:description"
      content: "How to pass a discrete GPU from a Linux host to a PAI virtual machine. Covers VFIO, vendor quirks, and the reality on macOS and Windows hypervisors."
  - tag: meta
    attrs:
      name: "keywords"
      content: "GPU passthrough VFIO, KVM GPU passthrough Linux, PAI VM GPU, Ollama GPU VM"
---


GPU passthrough hands a physical GPU directly to a virtual machine, letting a PAI VM use your real hardware for Ollama acceleration. This guide explains when it works, when it doesn't, and how to set it up on Linux hosts where it's most practical.

In this guide:
- Which host / VM combinations actually support GPU passthrough
- The IOMMU and VFIO setup on a Linux host
- How to configure VirtualBox, VMware, and KVM guests
- The truth about GPU passthrough on macOS and Windows hosts
- Verifying the VM sees and uses the GPU

**Prerequisites**: Comfortable with VT-d/AMD-Vi (IOMMU), kernel parameters, and Linux virtualization. This is advanced material.

## Hypervisor reality check

!!! warning "Most desktop hypervisors don't support real GPU passthrough"

    "GPU passthrough" as a working feature is effectively KVM/QEMU on Linux hosts.
    Everything else ranges from "painful" to "not possible."


| Host | Hypervisor | GPU passthrough | Recommendation |
|---|---|---|---|
| Linux | KVM + QEMU (libvirt) | **[Works well]** | Best option |
| Linux | VirtualBox | **[Partial]** | Experimental, flaky |
| Linux | VMware Workstation Pro | **[Works]** | Licensed, reliable |
| Windows | Hyper-V | **[GPU-P only]** | Paravirtualized, limited |
| Windows | VMware Workstation Pro | **[Works]** | Licensed, reliable |
| Windows | VirtualBox | **[No]** | Not supported |
| macOS (Intel) | Any | **[No]** | Apple never shipped VT-d on consumer machines in a useful way |
| macOS (Apple Silicon) | UTM / Parallels | **[No]** | No passthrough to Linux guests |

If you're on macOS or Windows without a pro hypervisor, the practical answer is: **flash a USB and boot natively** when you want GPU acceleration. VM mode is for convenience and testing.

## The KVM/QEMU path on Linux hosts

This is the well-trodden approach. The setup is involved but the result is a PAI VM with direct hardware access to your GPU.

### Required hardware

- CPU with IOMMU support: Intel VT-d or AMD-Vi (most modern CPUs have this; check BIOS)
- Motherboard with IOMMU support in BIOS (many cheap boards don't expose it)
- A **second** GPU in the host, or integrated graphics on the CPU (you can't pass through the GPU your host is actively using for display)
- Discrete GPU you want to pass: modern NVIDIA or AMD

### High-level setup


1. Enable IOMMU in BIOS: look for "VT-d" (Intel) or "IOMMU" / "AMD-Vi" (AMD). Reboot into BIOS, enable, save.

2. Enable IOMMU in the kernel on the host by editing `/etc/default/grub`:
   ```
   GRUB_CMDLINE_LINUX_DEFAULT="quiet intel_iommu=on iommu=pt"
   ```
   (Replace `intel_iommu` with `amd_iommu` on AMD.)

3. Update GRUB and reboot:
   ```bash
   sudo update-grub
   sudo reboot
   ```

4. Verify IOMMU is active:
   ```bash
   dmesg | grep -i iommu
   # Should show lines like "Intel-IOMMU: enabled" or "AMD-Vi: AMD IOMMUv2 loaded"
   ```

5. Find the PCI IDs of your GPU:
   ```bash
   lspci -nn | grep -Ei 'vga|3d|audio'
   ```
   You'll see two entries per GPU typically — the GPU and its audio device (HDMI audio). Note both vendor:device IDs.

6. Bind both to VFIO at boot by adding to kernel cmdline:
   ```
   vfio-pci.ids=10de:2482,10de:228b
   ```
   (Example: RTX 3070 + its audio. Replace with your IDs.)

7. Reboot, confirm:
   ```bash
   lspci -nnk -d 10de:2482
   # Should show "Kernel driver in use: vfio-pci"
   ```

8. Create a QEMU / libvirt VM with the GPU attached. For libvirt/virt-manager:
   - Add a PCI Host Device → your GPU
   - Add a second PCI Host Device → the GPU's audio function
   - Set CPU mode to "host-passthrough"
   - Allocate 8+ GB RAM
   - Boot from the PAI ISO

9. Inside the booted PAI VM, proceed with normal [GPU setup](gpu-setup.md) for the vendor.


!!! tip "virt-manager is your friend"

    The libvirt/virt-manager GUI handles the VM config details. You still need the host-level VFIO binding, but VM creation is point-and-click after that.


### VFIO gotchas

- **Reset bug**: some NVIDIA consumer cards refuse to initialize properly after a VM shutdown. Requires a host reboot or a patched kernel.
- **Code 43**: NVIDIA drivers historically refused to run in VMs. Current drivers (R470+) accept VMs, but you may need to hide the hypervisor: QEMU `cpu mode='host-passthrough'` with `<feature policy='disable' name='hypervisor'/>`.
- **ACS patches**: some motherboards group multiple devices in one IOMMU group, preventing isolation. Third-party kernel patches (ACS override) can split groups but introduce security risk.
- **Display**: the passed-through GPU renders the VM display directly to its connected monitor; the host continues using the other GPU. Plan cable routing accordingly.

## VMware Workstation Pro

VMware's Pro (paid) product supports GPU passthrough via "USB or PCI devices." The setup is much simpler than VFIO:

1. In the VM settings, add a USB or PCI Host Device.
2. Select your GPU from the list.
3. Start the VM.
4. Install the vendor driver inside the VM per [GPU setup](gpu-setup.md).

Free VMware Workstation Player does NOT support PCI passthrough. Pro is required.

## VirtualBox

VirtualBox's `VBoxManage modifyvm ... --pciattach` works in theory but fails for most modern GPUs. Don't expect reliable results. KVM is better for this use case on Linux.

## Windows Hyper-V (GPU-P)

Hyper-V supports "GPU Partitioning" (GPU-P), which shares the GPU between host and guest. It requires Windows 11 Pro / Server 2022 and specific GPU driver support. In practice, it's not currently useful for Linux guests like PAI — the driver plumbing is Windows-to-Windows.

## macOS reality

There's no path to GPU passthrough on macOS for PAI:
- Apple Silicon has no VT-d / IOMMU for external VMs
- Metal is Mac-only and not exposed to Linux guests
- UTM virtualization doesn't offer any GPU sharing to guests

If you need GPU acceleration on a Mac, use the **native macOS Ollama** build alongside PAI for privacy-sensitive work, or flash PAI onto a different machine.

## Verifying passthrough works

Once the VM boots and you've installed the GPU driver inside PAI:

=== "NVIDIA"
    ```bash
    nvidia-smi
    # Should list the GPU model with the host's driver version
    ```
=== "AMD"
    ```bash
    rocminfo | grep "Name:"
    ```

```bash
# Ollama should detect it
ollama ps
# Run a model and watch for GPU memory use
ollama run llama3.1:8b "hi"
```

## Performance with passthrough

Near-native. Typically 95-99% of what the GPU would do on a bare-metal install. The VM abstraction is effectively transparent once the GPU is bound to VFIO.

## Frequently asked questions

### Can I share the same GPU between my host and VM?
Only with GPU-P (Hyper-V) or specific ESXi configurations. For KVM/VFIO, the GPU is fully claimed by the VM while it's running.

### Do I need a second GPU?
You need *some* display for the host. If your CPU has integrated graphics, you can pass through the discrete GPU and use the iGPU for the host. Otherwise, yes, a second discrete GPU is required.

### Does GPU passthrough work on a laptop?
Rarely. Most laptops mux the discrete GPU through the integrated GPU's output, making isolation impossible. A few pro laptops with MUX switches can do it. Check before buying.

### Can I pass through eGPU over Thunderbolt?
In theory yes, in practice rarely. Thunderbolt hot-plug behavior conflicts with VFIO's expectation of PCI device stability. Expect a lot of tinkering.

### Does this break my host display?
If you pick a GPU currently driving a host monitor, yes — you'll lose that display while the VM runs. Plan: dedicate the discrete GPU to the VM, use the iGPU or another discrete GPU for the host.

### Is this worth the hassle for casual use?
Probably not. If you have a GPU-equipped desktop, flashing PAI to a USB and dual-booting is simpler than configuring passthrough. Reserve passthrough for workflows where you truly need both host and PAI running simultaneously.

### Will PAI persistence survive VM snapshots?
Snapshots of a VM with passthrough are fragile. The PCI binding state isn't captured well. Recommendation: shut down before snapshotting.

## Related documentation

- [**GPU Setup**](gpu-setup.md) — Driver installation once passthrough works
- [**Running in a VM**](running-in-a-vm.md) — General VM setup
- [**Building from Source**](advanced/building-from-source.md) — Pre-install drivers in custom ISO
- [**Choosing a Model**](../ai/choosing-a-model.md) — What VRAM you need
