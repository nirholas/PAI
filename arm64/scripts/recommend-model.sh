#!/usr/bin/env bash
# ── PAI Hardware-Aware Model Recommender ─────────────────────────────
# Inspects the system's available RAM and GPU, then recommends an
# Ollama model tier that will run well on this hardware.
#
# Single source of truth for model sizing — consumed by the first-boot
# picker (pai-model-picker), pai-models, pai-status, and any future
# PAI tooling that needs to answer "what should I run?".
#
# Usage:
#   recommend-model.sh                 # human-readable (default)
#   recommend-model.sh --name          # just the model name
#   recommend-model.sh --json          # structured output
#   recommend-model.sh --explain       # with reasoning
#   recommend-model.sh -h | --help
# ──────────────────────────────────────────────────────────────────────
set -euo pipefail

FORMAT="human"

usage() {
    cat <<'EOF'
recommend-model.sh — Suggest an Ollama model for this hardware

USAGE
    recommend-model.sh [--name|--json|--explain|-h|--help]

OPTIONS
    --name       Print only the model name (for scripting)
    --json       Print structured JSON output
    --explain    Print the recommendation plus reasoning
    -h, --help   Show this help

EXIT CODES
    0   Recommendation produced
    1   Could not detect RAM

EXAMPLES
    # In a shell script, pull the recommended model
    MODEL=$(recommend-model.sh --name)
    ollama pull "$MODEL"

    # Machine-readable for a status dashboard
    recommend-model.sh --json
EOF
}

# ── Parse args
while [[ $# -gt 0 ]]; do
    case "$1" in
        --name)    FORMAT="name";    shift ;;
        --json)    FORMAT="json";    shift ;;
        --explain) FORMAT="explain"; shift ;;
        -h|--help) usage; exit 0 ;;
        *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
    esac
done

# ── Detect RAM (in MB) ────────────────────────────────────────────────
if ! RAM_MB=$(free -m 2>/dev/null | awk '/^Mem:/{print $2}'); then
    echo "Error: could not read memory via free(1)" >&2
    exit 1
fi
if [[ -z "${RAM_MB:-}" || "${RAM_MB}" -le 0 ]]; then
    echo "Error: invalid RAM reading: '${RAM_MB}'" >&2
    exit 1
fi
RAM_GB=$((RAM_MB / 1024))

# ── Detect GPU (best effort, no hard dep on vendor tools) ─────────────
GPU_VENDOR="none"
GPU_VRAM_MB=0
GPU_MODEL=""

if command -v nvidia-smi >/dev/null 2>&1; then
    if out=$(nvidia-smi --query-gpu=memory.total,name --format=csv,noheader,nounits 2>/dev/null | head -1); then
        GPU_VENDOR="nvidia"
        GPU_VRAM_MB=$(awk -F', ' '{print $1}' <<<"$out" | tr -d ' ')
        GPU_MODEL=$(awk -F', ' '{print $2}' <<<"$out")
    fi
elif command -v rocm-smi >/dev/null 2>&1; then
    GPU_VENDOR="amd"
    # rocm-smi memory output varies by version; leave VRAM=0 and let
    # downstream treat AMD the same tier as CPU until we wire it up.
    GPU_MODEL=$(rocm-smi --showproductname 2>/dev/null | awk -F': ' '/Card series/{print $2; exit}' || echo "")
elif [[ -r /sys/class/drm/card0/device/vendor ]]; then
    vendor=$(cat /sys/class/drm/card0/device/vendor 2>/dev/null || echo "")
    case "$vendor" in
        0x10de) GPU_VENDOR="nvidia" ;;
        0x1002) GPU_VENDOR="amd" ;;
        0x8086) GPU_VENDOR="intel" ;;
    esac
fi

# ── Select tier based on effective memory ─────────────────────────────
# Use VRAM when present (GPU inference), otherwise RAM (CPU inference).
# Ollama can split across RAM+VRAM but that's a poor experience, so
# we recommend a size that fits comfortably in one.
if [[ "$GPU_VRAM_MB" -gt 0 ]]; then
    EFFECTIVE_MB=$GPU_VRAM_MB
    EFFECTIVE_SOURCE="GPU VRAM"
else
    EFFECTIVE_MB=$RAM_MB
    EFFECTIVE_SOURCE="system RAM"
fi

if   [[ "$EFFECTIVE_MB" -lt 4096 ]]; then
    MODEL="llama3.2:1b";     TIER="tiny";   SIZE_NOTE="~1 GB on disk";   PULL_NEEDED=false
elif [[ "$EFFECTIVE_MB" -lt 12288 ]]; then
    MODEL="llama3.2:3b";     TIER="small";  SIZE_NOTE="~2 GB download";  PULL_NEEDED=true
elif [[ "$EFFECTIVE_MB" -lt 24576 ]]; then
    MODEL="phi3:medium";     TIER="medium"; SIZE_NOTE="~8 GB download";  PULL_NEEDED=true
elif [[ "$EFFECTIVE_MB" -lt 49152 ]]; then
    MODEL="qwen2.5:14b";     TIER="large";  SIZE_NOTE="~9 GB download";  PULL_NEEDED=true
else
    MODEL="qwen2.5:32b";     TIER="xl";     SIZE_NOTE="~20 GB download"; PULL_NEEDED=true
fi

REASON="${EFFECTIVE_SOURCE}=${EFFECTIVE_MB}MB → tier=${TIER}"

# ── Output ────────────────────────────────────────────────────────────
case "$FORMAT" in
    name)
        echo "$MODEL"
        ;;
    json)
        cat <<EOF
{
  "model": "${MODEL}",
  "tier": "${TIER}",
  "pull_needed": ${PULL_NEEDED},
  "size_note": "${SIZE_NOTE}",
  "ram_mb": ${RAM_MB},
  "ram_gb": ${RAM_GB},
  "gpu_vendor": "${GPU_VENDOR}",
  "gpu_vram_mb": ${GPU_VRAM_MB},
  "gpu_model": "${GPU_MODEL}",
  "effective_mb": ${EFFECTIVE_MB},
  "effective_source": "${EFFECTIVE_SOURCE}"
}
EOF
        ;;
    explain)
        echo "Recommended model: ${MODEL}"
        echo "Tier:              ${TIER}"
        echo "Download:          ${SIZE_NOTE}"
        echo ""
        echo "Reasoning:"
        echo "  RAM:              ${RAM_GB} GB (${RAM_MB} MB)"
        if [[ "$GPU_VENDOR" != "none" ]]; then
            echo "  GPU:              ${GPU_VENDOR}${GPU_MODEL:+ ($GPU_MODEL)}"
            echo "  VRAM:             ${GPU_VRAM_MB} MB"
        else
            echo "  GPU:              none detected (CPU inference)"
        fi
        echo "  Deciding on:      ${EFFECTIVE_SOURCE} = ${EFFECTIVE_MB} MB"
        echo "  Selected tier:    ${TIER}"
        ;;
    human|*)
        echo "${MODEL} (${SIZE_NOTE})"
        ;;
esac
