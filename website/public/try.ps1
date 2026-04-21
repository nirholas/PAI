<#
.SYNOPSIS
    PAI — Try Private AI in a VM (Windows)

.DESCRIPTION
    Downloads the latest PAI ISO from GitHub, verifies SHA256, and launches
    it in QEMU with WHPX acceleration. No changes to your host OS.

    One-liner: irm https://pai.direct/try.ps1 | iex

    Exit codes:
        0 — success
        1 — user/validation error
        2 — download or verification failure
        3 — QEMU launch error
        4 — user cancelled

.PARAMETER IsoUrl
    Override ISO download URL. Requires -Sha256.

.PARAMETER Sha256
    Expected SHA256 hex digest. Required when -IsoUrl is used.

.PARAMETER Ram
    VM memory in MiB (default: 8192, minimum: 4096).

.PARAMETER Cpus
    Number of vCPUs (default: min(4, logical processors / 2)).

.PARAMETER Port
    Host port forwarded to Open WebUI (default: 8080).

.PARAMETER Keep
    Preserve cached ISO after exit.

.PARAMETER NoWhpx
    Force TCG (skip WHPX acceleration).

.PARAMETER Headless
    No display window; prints VNC URL.

.PARAMETER ForceLowRam
    Allow RAM below 4 GiB (not recommended for Ollama).

.EXAMPLE
    irm https://pai.direct/try.ps1 | iex

    Default one-liner — fetches latest release, boots in VM with WHPX.

.EXAMPLE
    .\try.ps1 -Ram 16384 -Cpus 8

    More resources for the VM.

.EXAMPLE
    .\try.ps1 -Keep -Port 9090

    Keep ISO on disk and use port 9090 for Open WebUI.

.LINK
    https://github.com/nirholas/pai

.NOTES
    SPDX-License-Identifier: GPL-3.0-or-later
#>
# SPDX-License-Identifier: GPL-3.0-or-later
[CmdletBinding()]
param(
    [string]$IsoUrl,
    [string]$Sha256,
    [int]$Ram = 8192,
    [int]$Cpus = 0,
    [int]$Port = 8080,
    [switch]$Keep,
    [switch]$NoWhpx,
    [switch]$Headless,
    [switch]$ForceLowRam
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ─── Constants ────────────────────────────────────────────────────────────────
$script:GitHubApi = 'https://api.github.com/repos/nirholas/pai/releases/latest'
$script:MinRamMB = 4096
$script:Version = '1.0.0'
$script:QemuProcess = $null
$script:IsoPath = $null
$script:KeepIso = $Keep.IsPresent

# UTF-8 console
try {
    if ([Console]::OutputEncoding.WebName -ne 'utf-8') {
        [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
    }
} catch { $null = $_ }

# TLS 1.2 for PowerShell 5.1
if ($PSVersionTable.PSVersion.Major -lt 6) {
    try {
        [Net.ServicePointManager]::SecurityProtocol =
            [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
    } catch { $null = $_ }
}

# ─── Helpers ──────────────────────────────────────────────────────────────────
function Write-PaiInfo {
    [Diagnostics.CodeAnalysis.SuppressMessageAttribute('PSAvoidUsingWriteHost', '')]
    param([string]$Text)
    Write-Host $Text -ForegroundColor Cyan
}

function Write-PaiWarn {
    [Diagnostics.CodeAnalysis.SuppressMessageAttribute('PSAvoidUsingWriteHost', '')]
    param([string]$Text)
    Write-Host $Text -ForegroundColor Yellow
}

function Write-PaiSuccess {
    [Diagnostics.CodeAnalysis.SuppressMessageAttribute('PSAvoidUsingWriteHost', '')]
    param([string]$Text)
    Write-Host $Text -ForegroundColor Green
}

function Write-PaiError {
    [Diagnostics.CodeAnalysis.SuppressMessageAttribute('PSAvoidUsingWriteHost', '')]
    param([string]$Text)
    Write-Host "Error: $Text" -ForegroundColor Red
}

function Exit-Pai {
    param([string]$Message, [int]$Code = 1)
    Write-PaiError $Message
    exit $Code
}

function Get-PaiSha256 {
    param([string]$Path)
    $hash = Get-FileHash -Path $Path -Algorithm SHA256
    return $hash.Hash.ToLower()
}

# ─── Validate parameters ─────────────────────────────────────────────────────
if ($IsoUrl -and -not $Sha256) {
    Exit-Pai '-Sha256 is required when -IsoUrl is specified' 1
}

if ($Ram -lt $script:MinRamMB -and -not $ForceLowRam) {
    Exit-Pai '4 GiB minimum recommended for Ollama; pass -ForceLowRam to override' 1
}

if ($Port -lt 1 -or $Port -gt 65535) {
    Exit-Pai '-Port must be between 1 and 65535' 1
}

# ─── Detect architecture ─────────────────────────────────────────────────────
$arch = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture
if ($arch -ne [System.Runtime.InteropServices.Architecture]::X64) {
    Exit-Pai "ARM64 support for try.ps1 is not yet available.`nFor Raspberry Pi, see: https://github.com/nirholas/pai/tree/main/arm64" 1
}

$qemuBin = 'qemu-system-x86_64'

# ─── Compute CPU count ────────────────────────────────────────────────────────
if ($Cpus -eq 0) {
    $logicalProcs = [Environment]::ProcessorCount
    $halfProcs = [Math]::Floor($logicalProcs / 2)
    $Cpus = [Math]::Min(4, $halfProcs)
    if ($Cpus -lt 1) { $Cpus = 1 }
}

if ($Cpus -lt 1) {
    Exit-Pai '-Cpus must be a positive integer' 1
}

# ─── Cache directory ──────────────────────────────────────────────────────────
$cacheDir = Join-Path $env:LOCALAPPDATA 'pai\cache'
if (-not (Test-Path $cacheDir)) {
    $null = New-Item -ItemType Directory -Path $cacheDir -Force
}

# ─── Banner ───────────────────────────────────────────────────────────────────
Write-Host ''
Write-Host ([char]0x2554 + ([string][char]0x2550 * 44) + [char]0x2557) -ForegroundColor White
Write-Host ([char]0x2551 + '       PAI ' + [char]0x2014 + ' Try Private AI in a VM        ' + [char]0x2551) -ForegroundColor White
Write-Host ([char]0x2551 + '  No USB, no reboot, no changes to your OS ' + [char]0x2551) -ForegroundColor White
Write-Host ([char]0x255A + ([string][char]0x2550 * 44) + [char]0x255D) -ForegroundColor White
Write-Host ''

# ─── Resolve ISO URL and SHA256 ───────────────────────────────────────────────
if (-not $IsoUrl) {
    Write-PaiInfo 'Fetching latest release info from GitHub...'

    try {
        $headers = @{ 'User-Agent' = 'PAI-Try/1.0' }
        if ($PSVersionTable.PSVersion.Major -ge 6) {
            $releaseJson = Invoke-RestMethod -Uri $script:GitHubApi -Headers $headers -TimeoutSec 30
        } else {
            $releaseJson = Invoke-RestMethod -Uri $script:GitHubApi -Headers $headers
        }
    } catch {
        Exit-Pai "Failed to fetch release info from GitHub API: $_" 2
    }

    # Find amd64 ISO asset
    $isoAsset = $releaseJson.assets | Where-Object { $_.name -match 'amd64.*\.iso$' } | Select-Object -First 1
    if (-not $isoAsset) {
        $isoAsset = $releaseJson.assets | Where-Object { $_.name -match '\.iso$' } | Select-Object -First 1
    }
    if (-not $isoAsset) {
        Exit-Pai 'No ISO asset found in the latest release' 2
    }
    $IsoUrl = $isoAsset.browser_download_url

    # Find SHA256SUMS
    $sha256Asset = $releaseJson.assets | Where-Object { $_.name -eq 'SHA256SUMS' } | Select-Object -First 1
    if ($sha256Asset) {
        try {
            $sha256Content = Invoke-RestMethod -Uri $sha256Asset.browser_download_url -Headers $headers
            $isoFilename = [System.IO.Path]::GetFileName($IsoUrl)
            $matchLine = ($sha256Content -split "`n") | Where-Object { $_ -match $isoFilename } | Select-Object -First 1
            if ($matchLine) {
                $Sha256 = ($matchLine -split '\s+')[0].ToLower()
            }
        } catch {
            Exit-Pai "Failed to download SHA256SUMS: $_" 2
        }
    }

    if (-not $Sha256) {
        Exit-Pai 'Could not find SHA256 hash for the ISO' 2
    }
}

$Sha256 = $Sha256.ToLower()
$isoFilename = [System.IO.Path]::GetFileName($IsoUrl)
$script:IsoPath = Join-Path $cacheDir $isoFilename

Write-PaiInfo "ISO: $isoFilename"
Write-PaiInfo "SHA256: $Sha256"

# ─── Check cache ─────────────────────────────────────────────────────────────
$needDownload = $true
if (Test-Path $script:IsoPath) {
    Write-PaiInfo "Found cached ISO at $($script:IsoPath) - verifying..."
    $cachedSha = Get-PaiSha256 -Path $script:IsoPath
    if ($cachedSha -eq $Sha256) {
        Write-PaiSuccess 'Cache hit - SHA256 verified.'
        $needDownload = $false
    } else {
        Write-PaiWarn 'Cached ISO SHA256 mismatch - re-downloading.'
        Remove-Item -Path $script:IsoPath -Force
    }
}

# ─── Download ISO ─────────────────────────────────────────────────────────────
if ($needDownload) {
    Write-PaiInfo 'Downloading PAI ISO...'

    try {
        $httpClient = [System.Net.Http.HttpClient]::new()
        $httpClient.Timeout = [TimeSpan]::FromMinutes(30)
        $httpClient.DefaultRequestHeaders.UserAgent.ParseAdd('PAI-Try/1.0')
        $response = $httpClient.GetAsync($IsoUrl, [System.Net.Http.HttpCompletionOption]::ResponseHeadersRead).Result

        if (-not $response.IsSuccessStatusCode) {
            Exit-Pai "Download failed with HTTP $($response.StatusCode)" 2
        }

        $totalBytes = $response.Content.Headers.ContentLength
        $stream = $response.Content.ReadAsStreamAsync().Result
        $fileStream = [System.IO.FileStream]::new($script:IsoPath, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write)

        try {
            $buffer = [byte[]]::new(81920)
            $totalRead = 0
            $lastPercent = -1

            while ($true) {
                $bytesRead = $stream.Read($buffer, 0, $buffer.Length)
                if ($bytesRead -eq 0) { break }
                $fileStream.Write($buffer, 0, $bytesRead)
                $totalRead += $bytesRead

                if ($totalBytes -and $totalBytes -gt 0) {
                    $percent = [Math]::Floor(($totalRead / $totalBytes) * 100)
                    if ($percent -ne $lastPercent) {
                        $totalMB = [Math]::Round($totalBytes / 1MB, 1)
                        $readMB = [Math]::Round($totalRead / 1MB, 1)
                        Write-Progress -Activity 'Downloading PAI ISO' -Status "${readMB} MB / ${totalMB} MB" -PercentComplete $percent
                        $lastPercent = $percent
                    }
                }
            }
            Write-Progress -Activity 'Downloading PAI ISO' -Completed
        } finally {
            $fileStream.Close()
            $stream.Close()
            $httpClient.Dispose()
        }
    } catch {
        if (Test-Path $script:IsoPath) { Remove-Item -Path $script:IsoPath -Force }
        Exit-Pai "Download failed. Check your network connection and retry.`n$_" 2
    }

    # Verify SHA256
    Write-PaiInfo 'Verifying SHA256...'
    $dlSha = Get-PaiSha256 -Path $script:IsoPath
    if ($dlSha -ne $Sha256) {
        Remove-Item -Path $script:IsoPath -Force
        Exit-Pai 'Download corrupted - SHA256 mismatch. Please retry.' 2
    }
    Write-PaiSuccess 'SHA256 verified.'
}

# ─── Check / Install QEMU ────────────────────────────────────────────────────
function Find-Qemu {
    # Check PATH first
    $cmd = Get-Command $qemuBin -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    # Common install locations
    $commonPaths = @(
        "${env:ProgramFiles}\qemu\$qemuBin.exe",
        "${env:ProgramFiles(x86)}\qemu\$qemuBin.exe",
        "C:\Program Files\qemu\$qemuBin.exe"
    )
    foreach ($p in $commonPaths) {
        if (Test-Path $p) { return $p }
    }
    return $null
}

function Install-Qemu {
    Write-Host ''
    Write-PaiWarn 'QEMU is not installed. PAI needs it to run the VM.'
    Write-Host ''

    # Try winget
    $winget = Get-Command 'winget' -ErrorAction SilentlyContinue
    if ($winget) {
        Write-Host "Install command: winget install --id SoftwareFreedomConservancy.QEMU" -ForegroundColor White
        Write-Host ''
        $answer = Read-Host 'Install QEMU now? [Y/n]'
        if ($answer -and $answer -notmatch '^[Yy]') {
            Exit-Pai 'QEMU installation cancelled.' 4
        }
        & winget install --id SoftwareFreedomConservancy.QEMU --accept-package-agreements --accept-source-agreements
        # Add to path for this session
        $qemuDir = "${env:ProgramFiles}\qemu"
        if (Test-Path $qemuDir) {
            $env:Path = "$qemuDir;$env:Path"
        }
        return
    }

    # Try scoop
    $scoop = Get-Command 'scoop' -ErrorAction SilentlyContinue
    if ($scoop) {
        Write-Host "Install command: scoop install qemu" -ForegroundColor White
        Write-Host ''
        $answer = Read-Host 'Install QEMU now? [Y/n]'
        if ($answer -and $answer -notmatch '^[Yy]') {
            Exit-Pai 'QEMU installation cancelled.' 4
        }
        & scoop install qemu
        return
    }

    Exit-Pai "Neither winget nor scoop found. Please install QEMU manually from:`n  https://www.qemu.org/download/#windows`nThen add its bin directory to your PATH." 1
}

$qemuPath = Find-Qemu
if (-not $qemuPath) {
    Install-Qemu
    $qemuPath = Find-Qemu
    if (-not $qemuPath) {
        Exit-Pai "QEMU still not found after install. Check your PATH." 3
    }
}

# ─── Verify QEMU version ─────────────────────────────────────────────────────
$qemuVersionOutput = & $qemuPath --version 2>&1 | Out-String
if ($qemuVersionOutput -notmatch 'QEMU emulator version') {
    Exit-Pai "Unexpected QEMU output. Is '$qemuPath' a valid QEMU binary?" 3
}

if ($qemuVersionOutput -match 'version (\d+)\.(\d+)') {
    $qemuMajor = [int]$Matches[1]
    if ($qemuMajor -lt 6) {
        Write-PaiWarn "QEMU version $($Matches[1]).$($Matches[2]) detected (< 6.0). Some features may not work correctly."
    }
}

# ─── Acceleration setup ───────────────────────────────────────────────────────
$accelArgs = @()
$accelName = 'TCG (no acceleration)'

if ($NoWhpx) {
    Write-PaiWarn 'Hardware acceleration disabled by user. VM will be slow.'
    $accelArgs = @('-accel', 'tcg')
} else {
    # Check WHPX
    $whpxAvailable = $false
    try {
        $feature = Get-WindowsOptionalFeature -Online -FeatureName HypervisorPlatform -ErrorAction SilentlyContinue
        if ($feature -and $feature.State -eq 'Enabled') {
            $whpxAvailable = $true
        }
    } catch { $null = $_ }

    if ($whpxAvailable) {
        $accelArgs = @('-accel', 'whpx')
        $accelName = 'WHPX'
    } else {
        Write-PaiWarn 'WHPX (Windows Hypervisor Platform) is not enabled.'
        Write-PaiWarn 'To enable it (requires reboot):'
        Write-Host '  Enable-WindowsOptionalFeature -Online -FeatureName HypervisorPlatform' -ForegroundColor White
        Write-Host ''
        Write-PaiWarn 'Falling back to TCG - VM will be very slow (10x+ slower).'

        # Check for VirtualBox conflict
        $vboxProc = Get-Process -Name 'VBoxSVC' -ErrorAction SilentlyContinue
        if ($vboxProc) {
            Write-PaiWarn 'VirtualBox is running. This may conflict with WHPX when enabled.'
        }

        $accelArgs = @('-accel', 'tcg')
    }
}

Write-PaiInfo "Acceleration: $accelName"

# ─── Display setup ────────────────────────────────────────────────────────────
$displayArgs = @()
if ($Headless) {
    $displayArgs = @('-display', 'none', '-vnc', ':0')
} else {
    $displayArgs = @('-display', 'sdl,show-cursor=on')
}

# ─── Build QEMU command ──────────────────────────────────────────────────────
$qemuArgs = @(
    $accelArgs
    '-cpu', 'host'
    '-smp', "$Cpus"
    '-m', "${Ram}M"
    '-cdrom', $script:IsoPath
    '-boot', 'd'
    '-nic', "user,model=virtio-net-pci,hostfwd=tcp::${Port}-:8080"
    '-usb', '-device', 'usb-tablet'
    '-audiodev', 'none,id=noaudio'
    $displayArgs
)

# ─── Launch QEMU ─────────────────────────────────────────────────────────────
Write-PaiInfo "Launching PAI VM ($Ram MiB RAM, $Cpus vCPUs)..."
Write-Host ''

try {
    $script:QemuProcess = Start-Process -FilePath $qemuPath -ArgumentList $qemuArgs -PassThru -NoNewWindow
} catch {
    Exit-Pai "Failed to launch QEMU: $_" 3
}

Write-Host ''
Write-Host ([char]0x25BA + ' PAI is booting in a VM window.') -ForegroundColor White
Write-Host ([char]0x25BA + " In about 30 seconds, open http://localhost:$Port in your browser to") -ForegroundColor White
Write-Host '  access Open WebUI. (The same URL works from inside the VM too.)' -ForegroundColor White
Write-Host ([char]0x25BA + ' Close the VM window or press Ctrl+C in this terminal to quit.') -ForegroundColor White
Write-Host ([char]0x25BA + ' Nothing is written to your host. The ISO is cached at:') -ForegroundColor White
Write-Host "  $($script:IsoPath)" -ForegroundColor Cyan
if (-not $Keep) {
    Write-Host '  (pass -Keep to preserve it)' -ForegroundColor White
}

if ($Headless) {
    Write-Host ''
    Write-PaiInfo 'Headless mode - connect via VNC at localhost:5900'
}

# ─── Wait for QEMU to exit ────────────────────────────────────────────────────
try {
    $script:QemuProcess.WaitForExit()
} catch {
    $null = $_
}

# ─── Cleanup ──────────────────────────────────────────────────────────────────
if ($script:QemuProcess -and -not $script:QemuProcess.HasExited) {
    try {
        # Give QEMU a few seconds to shut down gracefully before force-killing.
        if (-not $script:QemuProcess.WaitForExit(3000)) {
            $script:QemuProcess.Kill()
        }
    } catch { $null = $_ }
}

Write-Host ''
if ($script:KeepIso) {
    Write-PaiInfo "ISO preserved at: $($script:IsoPath)"
} else {
    if (Test-Path $script:IsoPath) {
        Remove-Item -Path $script:IsoPath -Force
    }
    # Remove cache dir if empty
    $remaining = Get-ChildItem -Path $cacheDir -ErrorAction SilentlyContinue
    if (-not $remaining) {
        Remove-Item -Path $cacheDir -Force -ErrorAction SilentlyContinue
    }
    Write-PaiInfo 'Cached ISO removed.'
}

Write-Host ''
Write-PaiSuccess 'Goodbye. Flash a real USB any time with:'
Write-Host '  irm https://pai.direct/flash.ps1 | iex' -ForegroundColor White
