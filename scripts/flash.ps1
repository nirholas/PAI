<#
.SYNOPSIS
    PAI — Windows Flasher. Download and write the latest PAI ISO to a USB drive.

.DESCRIPTION
    A one-shot Windows flasher that mirrors scripts/flash.sh for Linux and macOS.
    Self-elevates, discovers the latest PAI release from GitHub, verifies SHA256,
    lists removable USB drives, and writes the ISO raw to the chosen drive.

    Requires Windows 10 1809 (build 17763) or later, PowerShell 5.1 or later,
    and Administrator privileges (will prompt for UAC elevation).

    Exit codes:
        0 — success
        1 — user input / validation error
        2 — download or verification failure
        3 — disk operation failure
        4 — unexpected runtime error

.PARAMETER IsoUrl
    URL of the PAI ISO to flash. Skips GitHub release auto-discovery.
    If set, -Sha256 is required.

.PARAMETER Sha256
    Expected SHA256 hex digest of the ISO. Required when -IsoUrl is used.

.PARAMETER DiskNumber
    Target disk number (as reported by Get-Disk). Skips the interactive picker.
    Must reference a USB drive — internal disks are refused.

.PARAMETER SkipVerify
    Skip SHA256 verification. Dangerous — also requires -Force.

.PARAMETER Force
    Skip the typed-YES confirmation gate. For CI / scripted use.

.PARAMETER KeepDownload
    Do not delete the downloaded ISO after a successful flash.

.PARAMETER DownloadPath
    Directory where the ISO is downloaded. Defaults to $env:TEMP.

.PARAMETER LocalIso
    Path to a pre-downloaded ISO file. Skips download entirely and uses the
    specified file for flashing. Useful with the browser installer at
    pai.direct/flash-web. If set, -Sha256 is optional (verification is skipped
    unless -Sha256 is also provided).

.PARAMETER NoElevate
    Refuse to self-elevate. If not already running as Administrator the
    script exits 1. Useful for CI and non-interactive pipelines that do
    not have a UAC prompt attached.

.EXAMPLE
    irm https://pai.direct/flash.ps1 | iex

    The public one-liner — fetches the latest release and walks the user through
    picking a USB drive interactively.

.EXAMPLE
    .\flash.ps1 -IsoUrl https://example.com/pai-0.2.0-amd64.iso -Sha256 abc123...

    Flash a specific ISO URL with a known SHA256, bypassing GitHub API discovery.

.EXAMPLE
    .\flash.ps1 -DiskNumber 3 -Force

    Non-interactive flash of the latest release to disk 3, skipping the
    typed-YES confirmation. Intended for scripted use only.

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
    [int]$DiskNumber,
    [switch]$SkipVerify,
    [switch]$Force,
    [switch]$KeepDownload,
    [switch]$NoElevate,
    [string]$DownloadPath,
    [string]$LocalIso
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$script:LogPath = Join-Path $env:TEMP ("pai-flash-{0}.log" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
$script:OfflinedDisk = $null
$script:OriginalBoundParameters = $PSBoundParameters
$script:UserInterrupted = $false

# Box-drawing characters need UTF-8 on legacy consoles.
try {
    if ([Console]::OutputEncoding.WebName -ne 'utf-8') {
        [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
    }
} catch {
    $null = $_  # Non-fatal: console is still usable, just may mojibake.
}

# PowerShell 5.1's default TLS is 1.0, which GitHub API rejects.
if ($PSVersionTable.PSVersion.Major -lt 6) {
    try {
        [Net.ServicePointManager]::SecurityProtocol = `
            [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
    } catch {
        $null = $_
    }
}

function Write-PaiLog {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Message,
        [ValidateSet('INFO', 'WARN', 'ERROR')][string]$Level = 'INFO'
    )
    $ts = Get-Date -Format 'yyyy-MM-ddTHH:mm:ss.fffK'
    $line = '[{0}] [{1}] {2}' -f $ts, $Level, $Message
    try {
        Add-Content -Path $script:LogPath -Value $line -Encoding UTF8
    } catch {
        $null = $_  # Logging to the rotation file is best-effort.
    }
}

function Test-PaiAnsiCapable {
    [CmdletBinding()]
    [OutputType([bool])]
    param()
    if (-not [Environment]::UserInteractive) { return $false }
    if ($Host.Name -notlike '*Host*' -and $Host.Name -notlike '*ConsoleHost*') { return $false }
    if ($PSVersionTable.PSVersion.Major -ge 7) { return $true }
    return $false
}

function Write-PaiColor {
    [CmdletBinding()]
    [Diagnostics.CodeAnalysis.SuppressMessageAttribute(
        'PSAvoidUsingWriteHost', '',
        Justification = 'Deliberate user-facing terminal output; stdout/stderr redirection is handled via [Console] directly.')]
    param(
        [Parameter(Mandatory)][string]$Text,
        [ValidateSet('Red', 'Green', 'Yellow', 'Cyan', 'White')][string]$Color = 'White',
        [switch]$Bold,
        [switch]$NoNewline
    )
    $useAnsi = Test-PaiAnsiCapable
    if ($useAnsi) {
        $prefix = $null
        $reset = $null
        $psStyleVar = Get-Variable -Name PSStyle -Scope Global -ErrorAction SilentlyContinue
        if ($psStyleVar -and $psStyleVar.Value) {
            $style = $psStyleVar.Value
            $fgMap = @{
                Red    = $style.Foreground.Red
                Green  = $style.Foreground.Green
                Yellow = $style.Foreground.Yellow
                Cyan   = $style.Foreground.Cyan
                White  = $style.Foreground.White
            }
            $prefix = $fgMap[$Color]
            if ($Bold) { $prefix += $style.Bold }
            $reset = $style.Reset
        } else {
            $codes = @{
                Red    = '31'
                Green  = '32'
                Yellow = '33'
                Cyan   = '36'
                White  = '37'
            }
            $esc = [char]27
            $prefix = "$esc[" + $codes[$Color]
            if ($Bold) { $prefix += ';1' }
            $prefix += 'm'
            $reset = "$esc[0m"
        }
        if ($NoNewline) {
            [Console]::Write($prefix + $Text + $reset)
        } else {
            [Console]::WriteLine($prefix + $Text + $reset)
        }
    } else {
        $prevFg = [Console]::ForegroundColor
        try {
            [Console]::ForegroundColor = [ConsoleColor]::$Color
            if ($NoNewline) { [Console]::Write($Text) } else { [Console]::WriteLine($Text) }
        } finally {
            [Console]::ForegroundColor = $prevFg
        }
    }
}

function Write-PaiInfo { param([string]$Text) Write-PaiColor -Text $Text -Color Cyan; Write-PaiLog -Message $Text }
function Write-PaiWarn { param([string]$Text) Write-PaiColor -Text $Text -Color Yellow -Bold; Write-PaiLog -Level WARN -Message $Text }
function Write-PaiSuccess { param([string]$Text) Write-PaiColor -Text $Text -Color Green -Bold; Write-PaiLog -Message $Text }

function Write-PaiError {
    [CmdletBinding()]
    [Diagnostics.CodeAnalysis.SuppressMessageAttribute(
        'PSAvoidUsingWriteHost', '',
        Justification = 'Writes to stderr via [Console]::Error; Write-Error would surface through the error stream which CI-wraps differently.')]
    param(
        [Parameter(Mandatory)][string]$Message,
        [System.Management.Automation.ErrorRecord]$ErrorRecord
    )
    [Console]::Error.WriteLine("Error: $Message")
    Write-PaiLog -Level ERROR -Message $Message
    if ($ErrorRecord) {
        Write-PaiLog -Level ERROR -Message ($ErrorRecord | Out-String)
        Write-PaiLog -Level ERROR -Message ($ErrorRecord.ScriptStackTrace | Out-String)
    }
    [Console]::Error.WriteLine("Full log: $script:LogPath")
}

function Write-PaiBanner {
    [CmdletBinding()]
    param()
    Write-PaiColor -Text '' -Color White
    Write-PaiColor -Text '╔═══════════════════════════════════════════════════╗' -Color Cyan -Bold
    Write-PaiColor -Text '║           PAI — Windows Flasher                   ║' -Color Cyan -Bold
    Write-PaiColor -Text '║       Private AI on a bootable USB drive          ║' -Color Cyan -Bold
    Write-PaiColor -Text '╚═══════════════════════════════════════════════════╝' -Color Cyan -Bold
    Write-PaiColor -Text '' -Color White
}

function Test-PaiPowerShellVersion {
    [CmdletBinding()]
    [OutputType([bool])]
    param()
    $v = $PSVersionTable.PSVersion
    if ($v.Major -lt 5 -or ($v.Major -eq 5 -and $v.Minor -lt 1)) {
        [Console]::Error.WriteLine("PAI flasher requires PowerShell 5.1 or later. Detected: $v")
        [Console]::Error.WriteLine("Install PowerShell 7: https://aka.ms/powershell")
        return $false
    }
    return $true
}

function Test-PaiWindowsVersion {
    [CmdletBinding()]
    [OutputType([bool])]
    param()
    $isWin = $true
    if ($PSVersionTable.PSVersion.Major -ge 6) {
        $isWin = [bool]$IsWindows
    }
    if (-not $isWin) {
        [Console]::Error.WriteLine("PAI flasher runs on Windows only. For Linux or macOS use scripts/flash.sh.")
        return $false
    }
    try {
        $build = [Environment]::OSVersion.Version.Build
    } catch {
        Write-PaiError -Message "Unable to determine Windows version." -ErrorRecord $_
        return $false
    }
    if ($build -lt 17763) {
        [Console]::Error.WriteLine("PAI flasher requires Windows 10 1809 (build 17763) or newer. Detected build: $build")
        return $false
    }
    return $true
}

function Get-PaiCurrentPrincipal {
    [CmdletBinding()]
    [OutputType([Security.Principal.WindowsPrincipal])]
    param()
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    return [Security.Principal.WindowsPrincipal]::new($id)
}

function Test-PaiAdmin {
    [CmdletBinding()]
    [OutputType([bool])]
    param()
    $principal = Get-PaiCurrentPrincipal
    return $principal.IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)
}

function ConvertTo-PaiArgList {
    [CmdletBinding()]
    [OutputType([string[]])]
    param([Parameter(Mandatory)][System.Collections.IDictionary]$BoundParameters)
    $out = [System.Collections.Generic.List[string]]::new()
    foreach ($entry in $BoundParameters.GetEnumerator()) {
        $name = $entry.Key
        $value = $entry.Value
        if ($value -is [switch]) {
            if ($value.IsPresent) { $out.Add("-$name") }
            continue
        }
        if ($value -is [bool]) {
            $literal = if ($value) { '$true' } else { '$false' }
            $out.Add("-${name}:${literal}")
            continue
        }
        $out.Add("-$name")
        # Quote values that could be split by Start-Process.
        $asString = [string]$value
        if ($asString -match '\s' -or $asString -match '"') {
            $escaped = $asString -replace '"', '\"'
            $out.Add('"' + $escaped + '"')
        } else {
            $out.Add($asString)
        }
    }
    return $out.ToArray()
}

function Invoke-PaiSelfElevate {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$ScriptPath,
        [System.Collections.IDictionary]$BoundParameters
    )
    Write-PaiWarn 'Administrator privileges required — requesting UAC elevation...'
    $psExe = (Get-Process -Id $PID).Path
    if (-not $psExe) { $psExe = 'powershell.exe' }
    $quotedScript = if ($ScriptPath -match '\s') { '"' + $ScriptPath + '"' } else { $ScriptPath }
    $argList = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $quotedScript)
    if ($BoundParameters -and $BoundParameters.Count -gt 0) {
        $argList += (ConvertTo-PaiArgList -BoundParameters $BoundParameters)
    }
    try {
        Start-Process -FilePath $psExe -ArgumentList $argList -Verb RunAs -ErrorAction Stop | Out-Null
    } catch {
        Write-PaiError -Message "Elevation was cancelled or failed." -ErrorRecord $_
        exit 1
    }
}

function Get-PaiRelease {
    [CmdletBinding()]
    [OutputType([hashtable])]
    param(
        [string]$Repo = 'nirholas/pai'
    )
    $api = "https://api.github.com/repos/$Repo/releases/latest"
    Write-PaiInfo "Fetching latest release from $Repo..."
    $headers = @{
        'User-Agent' = 'pai-flash.ps1'
        'Accept'     = 'application/vnd.github+json'
    }
    try {
        $release = Invoke-RestMethod -Uri $api -Headers $headers -ErrorAction Stop
    } catch {
        throw "Failed to query GitHub releases API: $($_.Exception.Message)"
    }

    $assets = @($release.assets)
    $iso = $assets | Where-Object { $_.name -match '^pai-.*-amd64\.iso$' } | Select-Object -First 1
    if (-not $iso) {
        throw "Latest release ($($release.tag_name)) has no pai-*-amd64.iso asset."
    }

    $sha = $null
    $sidecar = $assets | Where-Object { $_.name -eq ($iso.name + '.sha256') } | Select-Object -First 1
    if ($sidecar) {
        try {
            $raw = Invoke-WebRequest -Uri $sidecar.browser_download_url -Headers $headers -UseBasicParsing -ErrorAction Stop
            $text = [System.Text.Encoding]::UTF8.GetString($raw.Content)
            $sha = ($text -split '\s+')[0].Trim().ToLowerInvariant()
        } catch {
            Write-PaiLog -Level WARN -Message "Sidecar fetch failed: $($_.Exception.Message)"
        }
    }
    if (-not $sha) {
        $sumsAsset = $assets | Where-Object { $_.name -eq 'SHA256SUMS' } | Select-Object -First 1
        if ($sumsAsset) {
            try {
                $raw = Invoke-WebRequest -Uri $sumsAsset.browser_download_url -Headers $headers -UseBasicParsing -ErrorAction Stop
                $text = [System.Text.Encoding]::UTF8.GetString($raw.Content)
                foreach ($line in ($text -split "`n")) {
                    $parts = $line.Trim() -split '\s+', 2
                    if ($parts.Count -eq 2 -and $parts[1].TrimStart('*') -eq $iso.name) {
                        $sha = $parts[0].Trim().ToLowerInvariant()
                        break
                    }
                }
            } catch {
                Write-PaiLog -Level WARN -Message "SHA256SUMS fetch failed: $($_.Exception.Message)"
            }
        }
    }
    if (-not $sha) {
        throw "Could not locate SHA256 for $($iso.name) (neither sidecar nor SHA256SUMS)."
    }

    return @{
        Version = $release.tag_name
        Url     = $iso.browser_download_url
        Name    = $iso.name
        Size    = [int64]$iso.size
        Sha256  = $sha
    }
}

function Format-PaiSize {
    [CmdletBinding()]
    [OutputType([string])]
    param([Parameter(Mandatory)][double]$Bytes)
    if ($Bytes -ge 1GB) { return ('{0:N2} GB' -f ($Bytes / 1GB)) }
    if ($Bytes -ge 1MB) { return ('{0:N2} MB' -f ($Bytes / 1MB)) }
    if ($Bytes -ge 1KB) { return ('{0:N2} KB' -f ($Bytes / 1KB)) }
    return ('{0} B' -f $Bytes)
}

function Get-PaiUsbDisk {
    [CmdletBinding()]
    [OutputType([object[]])]
    param()
    try {
        $all = @(Get-Disk -ErrorAction Stop)
    } catch {
        throw "Get-Disk failed: $($_.Exception.Message)"
    }
    $usb = $all | Where-Object {
        $_.BusType -eq 'USB' -and $_.Size -ge 4GB
    } | Sort-Object -Property Number
    return , @($usb)
}

function Show-PaiDiskTable {
    [CmdletBinding()]
    param([Parameter(Mandatory)][object[]]$Disks)
    Write-PaiColor -Text 'Detected USB drives:' -Color White -Bold
    Write-PaiColor -Text '' -Color White
    $i = 1
    Write-PaiColor -Text ('  {0,-3} {1,-5} {2,-28} {3,-10} {4,-12}' -f '#', 'Disk', 'FriendlyName', 'Size', 'Partition') -Color White -Bold
    foreach ($d in $Disks) {
        $size = Format-PaiSize -Bytes $d.Size
        $name = if ($d.FriendlyName) { $d.FriendlyName } else { '<unknown>' }
        if ($name.Length -gt 27) { $name = $name.Substring(0, 27) }
        $line = '  {0,-3} {1,-5} {2,-28} {3,-10} {4,-12}' -f "[$i]", $d.Number, $name, $size, $d.PartitionStyle
        Write-PaiColor -Text $line -Color White
        $i++
    }
    Write-PaiColor -Text '' -Color White
}

function Read-PaiDiskChoice {
    [CmdletBinding()]
    [OutputType([int])]
    param([Parameter(Mandatory)][object[]]$Disks)
    while ($true) {
        $prompt = "Select drive [1-$($Disks.Count)] (q to quit)"
        $raw = Read-Host $prompt
        if ($null -eq $raw) { return -1 }
        $trimmed = $raw.Trim()
        if ($trimmed -eq 'q' -or $trimmed -eq 'Q') { return -1 }
        $n = 0
        if ([int]::TryParse($trimmed, [ref]$n) -and $n -ge 1 -and $n -le $Disks.Count) {
            return $n - 1
        }
        Write-PaiWarn "Invalid selection: '$raw'. Enter a number between 1 and $($Disks.Count), or q to quit."
    }
}

function Confirm-PaiFlash {
    [CmdletBinding()]
    [OutputType([bool])]
    param(
        [Parameter(Mandatory)][object]$Disk,
        [switch]$Force
    )
    Write-PaiColor -Text '' -Color White
    Write-PaiColor -Text '╔══════════════════════════════════════════════════╗' -Color Red -Bold
    Write-PaiColor -Text '║  WARNING: ALL DATA ON THIS DEVICE WILL BE LOST   ║' -Color Red -Bold
    Write-PaiColor -Text '╚══════════════════════════════════════════════════╝' -Color Red -Bold
    $size = Format-PaiSize -Bytes $Disk.Size
    Write-PaiColor -Text ("  Target: Disk {0} — {1} ({2}, {3})" -f $Disk.Number, $Disk.FriendlyName, $size, $Disk.BusType) -Color Red -Bold
    Write-PaiColor -Text '' -Color White
    if ($Force) {
        Write-PaiWarn '-Force specified — skipping typed-YES confirmation.'
        return $true
    }
    $reply = Read-Host "Type 'YES' (case-sensitive) to confirm"
    return ($reply -ceq 'YES')
}

function Get-PaiRemoteLength {
    [CmdletBinding()]
    [OutputType([int64])]
    param(
        [Parameter(Mandatory)][System.Net.Http.HttpClient]$Client,
        [Parameter(Mandatory)][string]$Url
    )
    try {
        $headReq = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Head, $Url)
        $head = $Client.SendAsync($headReq).GetAwaiter().GetResult()
        try {
            if ($head.IsSuccessStatusCode -and $head.Content.Headers.ContentLength.HasValue) {
                return [int64]$head.Content.Headers.ContentLength.Value
            }
        } finally {
            $head.Dispose()
        }
    } catch {
        Write-PaiLog -Level WARN -Message "HEAD request failed: $($_.Exception.Message)"
    }
    return -1
}

function Invoke-PaiDownloadAttempt {
    [CmdletBinding()]
    [OutputType([bool])]
    param(
        [Parameter(Mandatory)][System.Net.Http.HttpClient]$Client,
        [Parameter(Mandatory)][string]$Url,
        [Parameter(Mandatory)][string]$DestinationPath,
        [Parameter(Mandatory)][int64]$ExpectedLength
    )
    $existing = 0L
    if (Test-Path -LiteralPath $DestinationPath) {
        $existing = (Get-Item -LiteralPath $DestinationPath).Length
    }
    if ($ExpectedLength -gt 0 -and $existing -eq $ExpectedLength) {
        Write-PaiInfo "Existing download matches Content-Length — skipping."
        return $true
    }
    if ($ExpectedLength -gt 0 -and $existing -gt $ExpectedLength) {
        Write-PaiWarn "Existing file is larger than expected; discarding and restarting."
        Remove-Item -LiteralPath $DestinationPath -Force -ErrorAction Stop
        $existing = 0L
    }

    $getReq = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Get, $Url)
    if ($existing -gt 0) {
        $getReq.Headers.Range = [System.Net.Http.Headers.RangeHeaderValue]::new($existing, $null)
        Write-PaiInfo ("Resuming from {0}" -f (Format-PaiSize $existing))
    }

    $response = $Client.SendAsync($getReq, [System.Net.Http.HttpCompletionOption]::ResponseHeadersRead).GetAwaiter().GetResult()
    $inStream = $null
    $outStream = $null
    try {
        if ($response.StatusCode -eq 416) {
            # Requested range not satisfiable — the server reports the file is
            # already fully present. Trust it and verify by size.
            if ($ExpectedLength -gt 0 -and $existing -eq $ExpectedLength) { return $true }
            throw "Server rejected Range request (416) and local size ($existing) does not match expected ($ExpectedLength)."
        }
        if (-not $response.IsSuccessStatusCode) {
            throw "HTTP $([int]$response.StatusCode) $($response.ReasonPhrase) fetching $Url"
        }

        $appending = ($response.StatusCode -eq [System.Net.HttpStatusCode]::PartialContent)
        if (-not $appending) {
            # Server ignored Range — start fresh.
            $existing = 0L
        }

        $total = $ExpectedLength
        if ($total -le 0 -and $response.Content.Headers.ContentLength.HasValue) {
            $total = [int64]$response.Content.Headers.ContentLength.Value
            if ($appending) { $total += $existing }
        }

        $mode = if ($appending) { [System.IO.FileMode]::Append } else { [System.IO.FileMode]::Create }
        $outStream = [System.IO.File]::Open($DestinationPath, $mode, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
        $inStream = $response.Content.ReadAsStreamAsync().GetAwaiter().GetResult()

        $bufSize = 1MB
        $buf = New-Object byte[] $bufSize
        $transferred = $existing
        $started = Get-Date
        $lastUpdate = [DateTime]::MinValue
        $read = 0
        while (($read = $inStream.Read($buf, 0, $bufSize)) -gt 0) {
            $outStream.Write($buf, 0, $read)
            $transferred += $read
            $now = Get-Date
            if (($now - $lastUpdate).TotalMilliseconds -ge 250) {
                $elapsed = ($now - $started).TotalSeconds
                $mbps = if ($elapsed -gt 0) { (($transferred - $existing) / 1MB) / $elapsed } else { 0 }
                $status = '{0} / {1}  ({2:N1} MB/s)' -f (Format-PaiSize $transferred), (Format-PaiSize ([math]::Max($total, 0))), $mbps
                if ($total -gt 0) {
                    $pct = [int](($transferred * 100) / $total)
                    Write-Progress -Activity 'Downloading PAI ISO' -Status $status -PercentComplete $pct
                } else {
                    Write-Progress -Activity 'Downloading PAI ISO' -Status $status
                }
                $lastUpdate = $now
            }
        }
        $outStream.Flush()
        Write-Progress -Activity 'Downloading PAI ISO' -Completed
        if ($ExpectedLength -gt 0 -and $transferred -ne $ExpectedLength) {
            throw "Short read: got $transferred bytes, expected $ExpectedLength."
        }
        return $true
    } finally {
        if ($outStream) { $outStream.Dispose() }
        if ($inStream)  { $inStream.Dispose() }
        $response.Dispose()
    }
}

function Invoke-PaiDownload {
    [CmdletBinding()]
    [OutputType([string])]
    param(
        [Parameter(Mandatory)][string]$Url,
        [Parameter(Mandatory)][string]$DestinationPath,
        [int]$MaxAttempts = 5
    )
    if ($MaxAttempts -lt 1) { $MaxAttempts = 1 }

    $null = [System.Reflection.Assembly]::LoadWithPartialName('System.Net.Http')
    $handler = [System.Net.Http.HttpClientHandler]::new()
    $handler.AllowAutoRedirect = $true
    $client = [System.Net.Http.HttpClient]::new($handler)
    $client.Timeout = [System.TimeSpan]::FromMinutes(60)
    $client.DefaultRequestHeaders.UserAgent.ParseAdd('pai-flash.ps1')

    $started = Get-Date
    try {
        Write-PaiInfo "Downloading: $Url"
        Write-PaiInfo "Destination: $DestinationPath"
        $expected = Get-PaiRemoteLength -Client $client -Url $Url

        $lastErr = $null
        for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
            try {
                if (Invoke-PaiDownloadAttempt -Client $client -Url $Url -DestinationPath $DestinationPath -ExpectedLength $expected) {
                    $elapsed = (Get-Date) - $started
                    $final = (Get-Item -LiteralPath $DestinationPath).Length
                    Write-PaiInfo ("Downloaded {0} in {1:N1}s" -f (Format-PaiSize $final), $elapsed.TotalSeconds)
                    return $DestinationPath
                }
            } catch {
                $lastErr = $_
                Write-PaiWarn ("Download attempt {0}/{1} failed: {2}" -f $attempt, $MaxAttempts, $_.Exception.Message)
                Write-PaiLog -Level WARN -Message ($_ | Out-String)
                if ($attempt -lt $MaxAttempts) {
                    $backoff = [Math]::Min(30, [Math]::Pow(2, $attempt - 1)) + (Get-Random -Minimum 0 -Maximum 2)
                    Write-PaiInfo ("Retrying in {0:N0}s..." -f $backoff)
                    Start-Sleep -Seconds $backoff
                }
            }
        }
        if ($lastErr) {
            throw "Download failed after $MaxAttempts attempts: $($lastErr.Exception.Message)"
        }
        throw "Download failed after $MaxAttempts attempts."
    } finally {
        $client.Dispose()
        $handler.Dispose()
    }
}

function Test-PaiSha256 {
    [CmdletBinding()]
    [OutputType([bool])]
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string]$Expected
    )
    Write-PaiInfo "Verifying SHA256..."
    $actual = (Get-FileHash -Path $Path -Algorithm SHA256).Hash.ToLowerInvariant()
    $want = $Expected.Trim().ToLowerInvariant()
    if ($actual -eq $want) {
        Write-PaiSuccess "SHA256 OK: $actual"
        return $true
    }
    Write-PaiError -Message "SHA256 mismatch."
    Write-PaiColor -Text "  Expected: $want"   -Color Red
    Write-PaiColor -Text "  Actual:   $actual" -Color Red
    return $false
}

function Invoke-PaiRawWrite {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][int]$Number,
        [Parameter(Mandatory)][string]$IsoPath
    )
    $physical = "\\.\PhysicalDrive$Number"
    $isoLen = (Get-Item -LiteralPath $IsoPath).Length
    Write-PaiInfo "Writing raw to $physical ($(Format-PaiSize $isoLen))..."

    $writeThrough = [System.IO.FileOptions]::WriteThrough
    $iso = [System.IO.File]::Open($IsoPath, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::Read)
    $disk = $null
    try {
        $disk = New-Object System.IO.FileStream($physical, [System.IO.FileMode]::Open, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None, 4MB, $writeThrough)
        $bufSize = 4MB
        $buf = New-Object byte[] $bufSize
        $read = 0
        $written = 0L
        $started = Get-Date
        $lastUpdate = [DateTime]::MinValue
        while (($read = $iso.Read($buf, 0, $bufSize)) -gt 0) {
            $disk.Write($buf, 0, $read)
            $written += $read
            $now = Get-Date
            if (($now - $lastUpdate).TotalMilliseconds -ge 500) {
                $elapsed = ($now - $started).TotalSeconds
                $mbps = if ($elapsed -gt 0) { ($written / 1MB) / $elapsed } else { 0 }
                $pct = [int](($written * 100) / $isoLen)
                $remaining = if ($mbps -gt 0) { ($isoLen - $written) / 1MB / $mbps } else { 0 }
                $status = '{0} / {1}  ({2:N1} MB/s, ETA {3:N0}s)' -f (Format-PaiSize $written), (Format-PaiSize $isoLen), $mbps, $remaining
                Write-Progress -Activity "Writing to $physical" -Status $status -PercentComplete $pct
                $lastUpdate = $now
            }
        }
        $disk.Flush($true)
        Write-Progress -Activity "Writing to $physical" -Completed
        $elapsed = (Get-Date) - $started
        Write-PaiSuccess ("Wrote {0} in {1:N1}s" -f (Format-PaiSize $written), $elapsed.TotalSeconds)
    } finally {
        if ($disk) { $disk.Dispose() }
        $iso.Dispose()
    }
}

function Invoke-PaiFlash {
    [CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'High')]
    param(
        [Parameter(Mandatory)][hashtable]$Release,
        [Parameter(Mandatory)][object]$Disk,
        [Parameter(Mandatory)][string]$DownloadDirectory,
        [switch]$SkipVerify,
        [switch]$KeepDownload,
        [string]$LocalIsoPath
    )
    $target = "\\.\PhysicalDrive$($Disk.Number)"
    if (-not $PSCmdlet.ShouldProcess($target, 'Erase disk and write PAI ISO')) {
        return
    }
    $overallStart = Get-Date
    $dest = Join-Path $DownloadDirectory $Release.Name
    $usingLocalIso = $false
    $dlElapsed = [timespan]::Zero

    if ($LocalIsoPath) {
        if (-not (Test-Path -LiteralPath $LocalIsoPath)) {
            Write-PaiError -Message "Local ISO not found: $LocalIsoPath"
            exit 1
        }
        Write-PaiInfo "Using pre-downloaded ISO: $LocalIsoPath"
        $dest = $LocalIsoPath
        $usingLocalIso = $true
    } else {
        $dlStart = Get-Date
        Invoke-PaiDownload -Url $Release.Url -DestinationPath $dest | Out-Null
        $dlElapsed = (Get-Date) - $dlStart
    }

    if ($SkipVerify) {
        Write-PaiWarn 'Skipping SHA256 verification (-SkipVerify).'
    } elseif (-not $Release.Sha256) {
        Write-PaiWarn 'No SHA256 provided — skipping verification.'
    } else {
        if (-not (Test-PaiSha256 -Path $dest -Expected $Release.Sha256)) {
            try {
                Remove-Item -LiteralPath $dest -Force -ErrorAction Stop
            } catch {
                Write-PaiLog -Level WARN -Message "Could not remove corrupt file: $($_.Exception.Message)"
            }
            exit 2
        }
    }

    try {
        Write-PaiInfo "Taking disk $($Disk.Number) offline..."
        Set-Disk -Number $Disk.Number -IsOffline $true -ErrorAction Stop
        $script:OfflinedDisk = $Disk.Number

        Write-PaiInfo "Clearing existing partition table..."
        Clear-Disk -Number $Disk.Number -RemoveData -RemoveOEM -Confirm:$false -ErrorAction Stop
    } catch {
        Write-PaiError -Message "Disk preparation failed." -ErrorRecord $_
        exit 3
    }

    $writeStart = Get-Date
    try {
        Invoke-PaiRawWrite -Number $Disk.Number -IsoPath $dest
    } catch {
        Write-PaiError -Message "Raw write failed." -ErrorRecord $_
        exit 3
    }
    $writeElapsed = (Get-Date) - $writeStart

    try {
        Write-PaiInfo "Bringing disk $($Disk.Number) online..."
        Set-Disk -Number $Disk.Number -IsOffline $false -ErrorAction Stop
        $script:OfflinedDisk = $null
        Update-Disk -Number $Disk.Number -ErrorAction SilentlyContinue
    } catch {
        Write-PaiLog -Level WARN -Message "Post-flash Set-Disk online failed: $($_.Exception.Message)"
    }

    if (-not $KeepDownload -and -not $usingLocalIso) {
        try { Remove-Item -LiteralPath $dest -Force -ErrorAction Stop } catch {
            Write-PaiLog -Level WARN -Message "Could not delete ISO: $($_.Exception.Message)"
        }
    }

    $total = (Get-Date) - $overallStart
    Write-PaiColor -Text '' -Color White
    Write-PaiColor -Text '╔═══════════════════════════════════════════════════╗' -Color Green -Bold
    Write-PaiColor -Text '║         PAI flashed successfully!                 ║' -Color Green -Bold
    Write-PaiColor -Text '╚═══════════════════════════════════════════════════╝' -Color Green -Bold
    Write-PaiColor -Text '' -Color White
    Write-PaiInfo ("Device:   \\.\PhysicalDrive{0}" -f $Disk.Number)
    if (-not $usingLocalIso) {
        Write-PaiInfo ("Download: {0:N1}s" -f $dlElapsed.TotalSeconds)
    }
    Write-PaiInfo ("Write:    {0:N1}s" -f $writeElapsed.TotalSeconds)
    Write-PaiInfo ("Total:    {0:N1}s" -f $total.TotalSeconds)
    Write-PaiColor -Text '' -Color White
    Write-PaiColor -Text 'Next steps:' -Color White -Bold
    Write-PaiColor -Text '  1. Safely eject the USB drive from the notification area.' -Color White
    Write-PaiColor -Text '  2. Plug it into the target machine and reboot.' -Color White
    Write-PaiColor -Text '  3. Tap the boot menu key (typically F12, F10, F9, Esc, or DEL).' -Color White
    Write-PaiColor -Text '     Vendor table: docs/first-steps/installing-and-booting' -Color White
    Write-PaiColor -Text '  4. If the USB does not appear, disable Secure Boot in firmware.' -Color White
    Write-PaiColor -Text '' -Color White
}

function Invoke-PaiMain {
    [CmdletBinding()]
    param()

    Write-PaiBanner

    if (-not (Test-PaiPowerShellVersion)) { exit 1 }
    if (-not (Test-PaiWindowsVersion)) { exit 1 }

    if ($SkipVerify -and -not $Force) {
        [Console]::Error.WriteLine("-SkipVerify is refused without -Force. Verification protects you from corrupt downloads; if you really must skip it, pass both flags.")
        exit 1
    }

    if ($IsoUrl -and -not $Sha256 -and -not $SkipVerify) {
        [Console]::Error.WriteLine("-IsoUrl requires -Sha256 (or -SkipVerify -Force).")
        exit 1
    }

    if (-not (Test-PaiAdmin)) {
        if ($NoElevate) {
            [Console]::Error.WriteLine("This script must be run as Administrator and -NoElevate forbids self-elevation.")
            exit 1
        }
        $scriptPath = $PSCommandPath
        if (-not $scriptPath -and $MyInvocation.MyCommand -and $MyInvocation.MyCommand.Path) {
            $scriptPath = $MyInvocation.MyCommand.Path
        }
        if (-not $scriptPath) {
            # Invoked via `irm | iex` or similar — no on-disk path to relaunch.
            # Save a copy so the elevated instance can run the same script.
            $scriptPath = Join-Path $env:TEMP ("pai-flash-{0}.ps1" -f (Get-Date -Format 'yyyyMMddHHmmss'))
            try {
                $source = $MyInvocation.MyCommand.ScriptBlock.ToString()
                Set-Content -LiteralPath $scriptPath -Value $source -Encoding UTF8 -ErrorAction Stop
            } catch {
                Write-PaiError -Message "This script must be run as Administrator. When invoked via 'irm | iex' you must download scripts/flash.ps1 to disk first, or launch an elevated PowerShell and re-run." -ErrorRecord $_
                exit 1
            }
        }
        Invoke-PaiSelfElevate -ScriptPath $scriptPath -BoundParameters $script:OriginalBoundParameters
        exit 0
    }

    # Authenticode: warn and exit if ExecutionPolicy requires signing but this copy is unsigned.
    if ((Get-ExecutionPolicy) -eq 'AllSigned' -and $PSCommandPath -and (Get-AuthenticodeSignature $PSCommandPath).Status -ne 'Valid') {
        Write-Warning @"
This script is running under ExecutionPolicy 'AllSigned' but its Authenticode
signature could not be verified. This is expected if you're running a locally
modified copy or a fork. To continue:

  - Use the official signed release: https://pai.direct/flash.ps1
  - Or set ExecutionPolicy for this session: Set-ExecutionPolicy -Scope Process Bypass
"@
        exit 1
    }

    if (-not $DownloadPath) { $DownloadPath = $env:TEMP }
    if (-not (Test-Path -LiteralPath $DownloadPath)) {
        try { New-Item -ItemType Directory -Path $DownloadPath -Force -ErrorAction Stop | Out-Null } catch {
            Write-PaiError -Message "Cannot create download directory '$DownloadPath'." -ErrorRecord $_
            exit 1
        }
    }

    $release = $null
    try {
        if ($LocalIso) {
            if (-not (Test-Path -LiteralPath $LocalIso)) {
                [Console]::Error.WriteLine("Local ISO not found: $LocalIso")
                exit 1
            }
            $fileName = [System.IO.Path]::GetFileName($LocalIso)
            $release = @{
                Version = 'local'
                Url     = ''
                Name    = $fileName
                Size    = (Get-Item -LiteralPath $LocalIso).Length
                Sha256  = if ($Sha256) { $Sha256.ToLowerInvariant() } else { '' }
            }
        } elseif ($IsoUrl) {
            $fileName = [System.IO.Path]::GetFileName(([System.Uri]$IsoUrl).AbsolutePath)
            if (-not $fileName) { $fileName = 'pai-amd64.iso' }
            $release = @{
                Version = 'custom'
                Url     = $IsoUrl
                Name    = $fileName
                Size    = 0
                Sha256  = if ($Sha256) { $Sha256.ToLowerInvariant() } else { '' }
            }
        } else {
            $release = Get-PaiRelease
            Write-PaiInfo ("Latest release: {0} ({1})" -f $release.Version, $release.Name)
        }
    } catch {
        Write-PaiError -Message $_.Exception.Message -ErrorRecord $_
        exit 2
    }

    $disk = $null
    try {
        if ($PSBoundParameters.ContainsKey('DiskNumber')) {
            try {
                $d = Get-Disk -Number $DiskNumber -ErrorAction Stop
            } catch {
                Write-PaiError -Message "No disk found with Number=$DiskNumber." -ErrorRecord $_
                exit 1
            }
            if ($d.BusType -ne 'USB') {
                [Console]::Error.WriteLine("Refusing to flash disk $DiskNumber — BusType is '$($d.BusType)', not 'USB'. Specify a removable USB drive.")
                exit 1
            }
            if ($d.Size -lt 4GB) {
                [Console]::Error.WriteLine("Refusing to flash disk $DiskNumber — size is $(Format-PaiSize $d.Size), below the 4 GB minimum.")
                exit 1
            }
            $disk = $d
        } else {
            $usb = Get-PaiUsbDisk
            if (-not $usb -or $usb.Count -eq 0) {
                [Console]::Error.WriteLine("No removable USB drives found (>=4 GB). Plug one in and try again.")
                exit 1
            }
            Show-PaiDiskTable -Disks $usb
            $idx = Read-PaiDiskChoice -Disks $usb
            if ($idx -lt 0) {
                Write-PaiInfo 'No changes made.'
                exit 0
            }
            $disk = $usb[$idx]
        }
    } catch {
        Write-PaiError -Message "Disk selection failed." -ErrorRecord $_
        exit 3
    }

    if (-not (Confirm-PaiFlash -Disk $disk -Force:$Force)) {
        Write-PaiInfo 'Aborted. No changes made.'
        exit 0
    }

    Invoke-PaiFlash -Release $release -Disk $disk -DownloadDirectory $DownloadPath -SkipVerify:$SkipVerify -KeepDownload:$KeepDownload -LocalIsoPath $LocalIso
}

$script:FinalExitCode = 0
try {
    Invoke-PaiMain
    $script:FinalExitCode = 0
} catch [System.Management.Automation.PipelineStoppedException] {
    $script:UserInterrupted = $true
    Write-PaiLog -Level WARN -Message 'User interrupted (Ctrl+C).'
    $script:FinalExitCode = 130
} catch {
    Write-PaiError -Message "Unexpected error: $($_.Exception.Message)" -ErrorRecord $_
    $script:FinalExitCode = 4
} finally {
    if ($null -ne $script:OfflinedDisk) {
        try {
            Set-Disk -Number $script:OfflinedDisk -IsOffline $false -ErrorAction Stop
            Write-PaiLog -Message "Brought disk $script:OfflinedDisk back online in finally block."
        } catch {
            Write-PaiLog -Level ERROR -Message "finally: could not bring disk $script:OfflinedDisk online: $($_.Exception.Message)"
        }
    }
    if ($script:UserInterrupted) {
        [Console]::Error.WriteLine('Interrupted. No disk changes were persisted.')
    }
}
exit $script:FinalExitCode
