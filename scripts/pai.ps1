# SPDX-License-Identifier: GPL-3.0-or-later
# pai.ps1 — CLI wrapper for PAI (Private AI)
# https://pai.direct

#Requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$script:PAI_CLI_VERSION = '0.1.0'
$script:PAI_REPO = 'nirholas/pai'
$script:PAI_CACHE_DIR = Join-Path $env:LOCALAPPDATA 'pai\cache'
$script:PAI_CACHE_TTL = 86400  # 24 hours

function Get-PaiScriptDir {
    [CmdletBinding()]
    [OutputType([string])]
    param()
    if ($PSScriptRoot) { return $PSScriptRoot }
    return Split-Path -Parent $MyInvocation.ScriptName
}

function Get-PaiLatestVersion {
    <#
    .SYNOPSIS
        Fetch latest PAI release version from GitHub API with 24h cache.
    #>
    [CmdletBinding()]
    [OutputType([string])]
    param()

    if (-not (Test-Path $script:PAI_CACHE_DIR)) {
        New-Item -ItemType Directory -Path $script:PAI_CACHE_DIR -Force | Out-Null
    }

    $cacheFile = Join-Path $script:PAI_CACHE_DIR 'latest.json'

    # Check cache freshness
    if (Test-Path $cacheFile) {
        $mtime = (Get-Item $cacheFile).LastWriteTime
        $age = ((Get-Date) - $mtime).TotalSeconds
        if ($age -lt $script:PAI_CACHE_TTL) {
            try {
                $cached = Get-Content $cacheFile -Raw | ConvertFrom-Json
                if ($cached.tag_name) {
                    return ($cached.tag_name -replace '^v', '')
                }
            }
            catch {
                # Cache corrupt, refetch
            }
        }
    }

    # Fetch from API
    $url = "https://api.github.com/repos/$script:PAI_REPO/releases/latest"
    try {
        $response = Invoke-RestMethod -Uri $url -UseBasicParsing -ErrorAction Stop
        $response | ConvertTo-Json -Depth 10 | Set-Content $cacheFile -Encoding UTF8
        return ($response.tag_name -replace '^v', '')
    }
    catch {
        return 'unknown (could not reach GitHub API)'
    }
}

function Invoke-PaiFlash {
    <#
    .SYNOPSIS
        Flash PAI to a USB drive interactively.
    #>
    [CmdletBinding()]
    param(
        [Parameter(ValueFromRemainingArguments)]
        [string[]]$Arguments
    )

    if ($Arguments -and $Arguments[0] -eq '--help') {
        Write-Output 'Usage: pai flash'
        Write-Output ''
        Write-Output 'Flash PAI to a USB drive interactively.'
        return
    }

    $scriptDir = Get-PaiScriptDir
    $flashScript = Join-Path $scriptDir 'flash.ps1'

    if (-not (Test-Path $flashScript)) {
        Write-Error "pai: error: flash.ps1 not found at $flashScript"
        exit 1
    }

    & $flashScript @Arguments
}

function Invoke-PaiTry {
    <#
    .SYNOPSIS
        Launch PAI in a local VM using QEMU.
    #>
    [CmdletBinding()]
    param(
        [Parameter(ValueFromRemainingArguments)]
        [string[]]$Arguments
    )

    if ($Arguments -and $Arguments[0] -eq '--help') {
        Write-Output 'Usage: pai try'
        Write-Output ''
        Write-Output 'Launch PAI in a local VM using QEMU.'
        return
    }

    $scriptDir = Get-PaiScriptDir
    $tryScript = Join-Path $scriptDir 'try.ps1'

    if (-not (Test-Path $tryScript)) {
        Write-Error "pai: error: try.ps1 not found at $tryScript"
        exit 1
    }

    & $tryScript @Arguments
}

function Test-PaiVerify {
    <#
    .SYNOPSIS
        Verify a downloaded ISO against SHA256SUMS from the release.
    #>
    [CmdletBinding()]
    param(
        [Parameter(ValueFromRemainingArguments)]
        [string[]]$Arguments
    )

    if ($Arguments -and $Arguments[0] -eq '--help') {
        Write-Output 'Usage: pai verify <iso-file>'
        Write-Output ''
        Write-Output 'Verify a downloaded ISO against SHA256SUMS from the release.'
        return
    }

    if (-not $Arguments -or $Arguments.Count -eq 0) {
        Write-Output 'Usage: pai verify <iso-file>'
        Write-Output ''
        Write-Output 'Verify a downloaded ISO against SHA256SUMS from the release.'
        exit 1
    }

    $isoFile = $Arguments[0]

    if (-not (Test-Path $isoFile)) {
        Write-Error "pai: error: file not found: $isoFile"
        exit 1
    }

    Write-Output 'Fetching SHA256SUMS from latest release...'
    $sumsUrl = "https://github.com/$script:PAI_REPO/releases/latest/download/SHA256SUMS"

    try {
        $sums = Invoke-RestMethod -Uri $sumsUrl -UseBasicParsing -ErrorAction Stop
    }
    catch {
        Write-Error 'pai: error: could not download SHA256SUMS'
        exit 1
    }

    $basename = Split-Path -Leaf $isoFile
    $matchLine = ($sums -split "`n") | Where-Object { $_ -match [regex]::Escape($basename) } | Select-Object -First 1

    if (-not $matchLine) {
        Write-Error "pai: error: no checksum found for $basename in SHA256SUMS"
        exit 1
    }

    $expected = ($matchLine -split '\s+')[0]

    Write-Output "Computing SHA256 of $basename..."
    $actual = (Get-FileHash $isoFile -Algorithm SHA256).Hash.ToLower()
    $expected = $expected.ToLower()

    if ($actual -eq $expected) {
        Write-Output "  SHA256 verified: $actual"
        return
    }
    else {
        Write-Error "  SHA256 mismatch!`n  expected: $expected`n  got:      $actual"
        exit 1
    }
}

function Invoke-PaiUpdate {
    <#
    .SYNOPSIS
        Check for a newer PAI release and print upgrade instructions.
    #>
    [CmdletBinding()]
    param(
        [Parameter(ValueFromRemainingArguments)]
        [string[]]$Arguments
    )

    if ($Arguments -and $Arguments[0] -eq '--help') {
        Write-Output 'Usage: pai update'
        Write-Output ''
        Write-Output 'Check for a newer PAI release and print upgrade instructions.'
        return
    }

    Write-Output 'Checking for updates...'
    $latest = Get-PaiLatestVersion

    Write-Output "Installed CLI: $script:PAI_CLI_VERSION"
    Write-Output "Latest PAI release: $latest"
    Write-Output ''

    # Detect install method and show context-aware upgrade path
    $scoopDir = if ($env:SCOOP) { $env:SCOOP } else { Join-Path $env:USERPROFILE 'scoop' }
    $paiCmd = (Get-Command pai -ErrorAction SilentlyContinue)
    $cmdSource = if ($paiCmd) { $paiCmd.Source } else { '' }

    if ($cmdSource -like "*$scoopDir*") {
        Write-Output 'To upgrade, run:'
        Write-Output '  scoop update pai'
    }
    elseif (Get-Command winget -ErrorAction SilentlyContinue) {
        # Check if PAI was installed via winget
        $wingetList = winget list --id PAI.PAI 2>$null
        if ($wingetList -match 'PAI.PAI') {
            Write-Output 'To upgrade, run:'
            Write-Output '  winget upgrade PAI.PAI'
        }
        else {
            Write-Output 'To upgrade, download the latest release:'
            Write-Output "  https://github.com/$script:PAI_REPO/releases/latest"
        }
    }
    else {
        Write-Output 'To upgrade, download the latest release:'
        Write-Output "  https://github.com/$script:PAI_REPO/releases/latest"
    }
}

function Get-PaiVersion {
    <#
    .SYNOPSIS
        Print the installed CLI version and latest PAI release.
    #>
    [CmdletBinding()]
    param(
        [Parameter(ValueFromRemainingArguments)]
        [string[]]$Arguments
    )

    if ($Arguments -and $Arguments[0] -eq '--help') {
        Write-Output 'Usage: pai version'
        Write-Output ''
        Write-Output 'Print the installed CLI version and latest PAI release.'
        return
    }

    Write-Output "pai CLI version: $script:PAI_CLI_VERSION"
    $latest = Get-PaiLatestVersion
    Write-Output "Latest PAI release: $latest"
}

function Test-PaiDoctor {
    <#
    .SYNOPSIS
        Check that prerequisites for PAI are installed.
    #>
    [CmdletBinding()]
    param(
        [Parameter(ValueFromRemainingArguments)]
        [string[]]$Arguments
    )

    if ($Arguments -and $Arguments[0] -eq '--help') {
        Write-Output 'Usage: pai doctor'
        Write-Output ''
        Write-Output 'Check that prerequisites for PAI are installed.'
        return
    }

    $ok = 0
    $warn = 0

    Write-Output 'PAI Doctor'
    Write-Output '=========='
    Write-Output ''

    # Install method detection
    $scoopDir = if ($env:SCOOP) { $env:SCOOP } else { Join-Path $env:USERPROFILE 'scoop' }
    if ((Get-Command pai -ErrorAction SilentlyContinue) -and
        (Get-Command pai -ErrorAction SilentlyContinue).Source -like "*$scoopDir*") {
        Write-Output 'Install method: Scoop'
    }
    else {
        Write-Output 'Install method: manual / git'
    }
    Write-Output ''

    # Check commands
    $commands = @('curl', 'qemu-system-x86_64', 'qemu-system-aarch64')
    foreach ($cmd in $commands) {
        if (Get-Command $cmd -ErrorAction SilentlyContinue) {
            Write-Output "  $cmd"
            $ok++
        }
        else {
            Write-Output "  $cmd (not found)"
            $warn++
        }
    }

    # PowerShell version
    Write-Output ''
    $psVer = $PSVersionTable.PSVersion
    if ($psVer.Major -ge 5) {
        Write-Output "  PowerShell $psVer"
        $ok++
    }
    else {
        Write-Output "  PowerShell $psVer (5.1+ recommended)"
        $warn++
    }

    # Windows version
    $osVersion = [System.Environment]::OSVersion.Version
    if ($osVersion.Build -ge 17763) {
        Write-Output "  Windows build $($osVersion.Build)"
        $ok++
    }
    else {
        Write-Output "  Windows build $($osVersion.Build) (17763+ recommended)"
        $warn++
    }

    Write-Output ''
    Write-Output "$ok OK, $warn warnings"

    if ($warn -gt 0) { exit 1 }
}

function Show-PaiHelp {
    <#
    .SYNOPSIS
        Display help for the pai CLI.
    #>
    [CmdletBinding()]
    param()

    Write-Output @"
Usage: pai <command> [options]

Commands:
  flash         Flash PAI to a USB drive (interactive)
  try           Launch PAI in a local VM (QEMU)
  verify <iso>  Verify an ISO's SHA256 against SHA256SUMS
  update        Check for a newer PAI release
  version       Print CLI and latest PAI release versions
  doctor        Check prerequisites for PAI
  help          Show this help message

Options:
  --version     Same as 'pai version'
  --help        Same as 'pai help'

Documentation: https://docs.pai.direct
"@
}

# --- Main dispatch ---

$command = if ($args.Count -gt 0) { $args[0] } else { '' }
$remaining = if ($args.Count -gt 1) { $args[1..($args.Count - 1)] } else { @() }

switch ($command) {
    'flash'     { Invoke-PaiFlash @remaining }
    'try'       { Invoke-PaiTry @remaining }
    'verify'    { Test-PaiVerify @remaining }
    'update'    { Invoke-PaiUpdate @remaining }
    'version'   { Get-PaiVersion @remaining }
    '--version' { Get-PaiVersion @remaining }
    'doctor'    { Test-PaiDoctor @remaining }
    'help'      { Show-PaiHelp }
    '--help'    { Show-PaiHelp }
    '-h'        { Show-PaiHelp }
    ''          { Show-PaiHelp }
    default {
        Write-Error "pai: unknown command: $command"
        Show-PaiHelp
        exit 1
    }
}
