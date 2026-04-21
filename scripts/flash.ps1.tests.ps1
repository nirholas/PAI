# SPDX-License-Identifier: GPL-3.0-or-later
#
# Pester v5 tests for scripts/flash.ps1.
#
# The script top-level executes Invoke-PaiMain on load, so these tests
# dot-source it with a guard environment variable and assert it bails
# out before running. We then import the functions via scope surgery:
# the script defines advanced functions in script scope, which are
# available to the test once it has dot-sourced successfully.
#
# Run:
#   Invoke-Pester -Path scripts/flash.ps1.tests.ps1

BeforeAll {
    $script:FlashPath = Join-Path $PSScriptRoot 'flash.ps1'
    if (-not (Test-Path -LiteralPath $script:FlashPath)) {
        throw "flash.ps1 not found at $script:FlashPath"
    }

    $script:IsWindowsHost = $true
    if ($PSVersionTable.PSVersion.Major -ge 6) {
        $script:IsWindowsHost = [bool]$IsWindows
    }

    # On non-Windows hosts the Storage module doesn't ship Get-Disk, and
    # Pester's Mock requires the command to exist. Provide a harmless stub
    # so the disk-picker tests can replace it.
    if (-not (Get-Command -Name Get-Disk -ErrorAction SilentlyContinue)) {
        function global:Get-Disk { param([int]$Number) }
    }

    # Parse the script and extract function definitions only, so we can
    # exercise helpers without triggering Invoke-PaiMain.
    $ast = [System.Management.Automation.Language.Parser]::ParseFile(
        $script:FlashPath, [ref]$null, [ref]$null
    )
    $functions = $ast.FindAll(
        { param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] },
        $true
    )
    $sb = [System.Text.StringBuilder]::new()
    [void]$sb.AppendLine("Set-StrictMode -Version Latest")
    [void]$sb.AppendLine("`$ErrorActionPreference = 'Stop'")
    $tempRoot = [System.IO.Path]::GetTempPath()
    [void]$sb.AppendLine("`$script:LogPath = [System.IO.Path]::Combine('$($tempRoot -replace "'", "''")', 'pai-flash-test.log')")
    [void]$sb.AppendLine("`$script:OfflinedDisk = `$null")
    foreach ($fn in $functions) {
        [void]$sb.AppendLine($fn.Extent.Text)
    }
    . ([scriptblock]::Create($sb.ToString()))
}

Describe 'Test-PaiSha256' {
    It 'returns true for a matching hash' {
        $tmp = (New-TemporaryFile).FullName
        try {
            'hello world' | Set-Content -LiteralPath $tmp -NoNewline
            $expected = (Get-FileHash -Path $tmp -Algorithm SHA256).Hash
            (Test-PaiSha256 -Path $tmp -Expected $expected) | Should -BeTrue
            (Test-PaiSha256 -Path $tmp -Expected $expected.ToLowerInvariant()) | Should -BeTrue
        } finally {
            Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
        }
    }

    It 'returns false for a mismatched hash' {
        $tmp = (New-TemporaryFile).FullName
        try {
            'hello world' | Set-Content -LiteralPath $tmp -NoNewline
            $bogus = ('0' * 64)
            (Test-PaiSha256 -Path $tmp -Expected $bogus) | Should -BeFalse
        } finally {
            Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
        }
    }
}

Describe 'Format-PaiSize' {
    It 'formats gigabytes' { (Format-PaiSize -Bytes 3GB) | Should -Match 'GB' }
    It 'formats megabytes' { (Format-PaiSize -Bytes 5MB) | Should -Match 'MB' }
    It 'formats kilobytes' { (Format-PaiSize -Bytes 2KB) | Should -Match 'KB' }
    It 'formats bytes'     { (Format-PaiSize -Bytes 42)  | Should -Match '^42 B$' }
}

Describe 'Get-PaiUsbDisk' {
    It 'filters out non-USB disks' {
        Mock Get-Disk {
            @(
                [pscustomobject]@{ Number = 0; BusType = 'SATA'; Size = 512GB; FriendlyName = 'Internal SSD'; PartitionStyle = 'GPT' }
                [pscustomobject]@{ Number = 1; BusType = 'USB';  Size = 32GB;  FriendlyName = 'SanDisk Ultra'; PartitionStyle = 'MBR' }
                [pscustomobject]@{ Number = 2; BusType = 'NVMe'; Size = 1TB;   FriendlyName = 'NVMe SSD';      PartitionStyle = 'GPT' }
            )
        }
        $result = Get-PaiUsbDisk
        $result.Count | Should -Be 1
        $result[0].Number | Should -Be 1
        $result[0].BusType | Should -Be 'USB'
    }

    It 'filters out USB disks smaller than 4 GB' {
        Mock Get-Disk {
            @(
                [pscustomobject]@{ Number = 3; BusType = 'USB'; Size = 2GB;  FriendlyName = 'Tiny stick';  PartitionStyle = 'MBR' }
                [pscustomobject]@{ Number = 4; BusType = 'USB'; Size = 16GB; FriendlyName = 'Normal stick'; PartitionStyle = 'MBR' }
            )
        }
        $result = Get-PaiUsbDisk
        $result.Count | Should -Be 1
        $result[0].Number | Should -Be 4
    }

    It 'returns empty when no USB disks present' {
        Mock Get-Disk {
            @(
                [pscustomobject]@{ Number = 0; BusType = 'SATA'; Size = 512GB; FriendlyName = 'Internal SSD'; PartitionStyle = 'GPT' }
            )
        }
        $result = Get-PaiUsbDisk
        @($result).Count | Should -Be 0
    }
}

Describe 'Test-PaiAdmin' {
    It 'returns a boolean without throwing' -Skip:(-not $script:IsWindowsHost) {
        { Test-PaiAdmin } | Should -Not -Throw
        (Test-PaiAdmin) | Should -BeOfType [bool]
    }

    It 'returns false when the current principal is not in the Administrator role' {
        Mock Get-PaiCurrentPrincipal {
            $mockPrincipal = [pscustomobject]@{}
            $mockPrincipal | Add-Member -MemberType ScriptMethod -Name IsInRole -Value { param($role) $false }
            return $mockPrincipal
        }
        (Test-PaiAdmin) | Should -BeFalse
    }

    It 'returns true when the current principal is in the Administrator role' {
        Mock Get-PaiCurrentPrincipal {
            $mockPrincipal = [pscustomobject]@{}
            $mockPrincipal | Add-Member -MemberType ScriptMethod -Name IsInRole -Value { param($role) $true }
            return $mockPrincipal
        }
        (Test-PaiAdmin) | Should -BeTrue
    }
}

Describe 'ConvertTo-PaiArgList' {
    It 'emits -Switch for present switches and omits absent ones' {
        $params = [ordered]@{ Force = [switch]$true; KeepDownload = [switch]$false }
        $out = ConvertTo-PaiArgList -BoundParameters $params
        $out | Should -Contain '-Force'
        $out | Should -Not -Contain '-KeepDownload'
    }

    It 'quotes string values containing spaces' {
        $params = [ordered]@{ DownloadPath = 'C:\Users\Nick Name\Downloads' }
        $out = ConvertTo-PaiArgList -BoundParameters $params
        $out | Should -Contain '-DownloadPath'
        ($out -join ' ') | Should -Match '"C:\\Users\\Nick Name\\Downloads"'
    }

    It 'passes bare tokens for space-free values' {
        $params = [ordered]@{ DiskNumber = 3 }
        $out = ConvertTo-PaiArgList -BoundParameters $params
        ($out -join ' ') | Should -Be '-DiskNumber 3'
    }
}

Describe 'Parameter validation (child process)' -Skip:(-not $script:IsWindowsHost) {
    BeforeAll {
        $script:TmpOut = [System.IO.Path]::GetTempFileName()
        $script:TmpErr = [System.IO.Path]::GetTempFileName()
    }
    AfterAll {
        Remove-Item -LiteralPath $script:TmpOut, $script:TmpErr -Force -ErrorAction SilentlyContinue
    }

    It 'rejects -IsoUrl without -Sha256 and prints a matching error' {
        $pwshExe = (Get-Process -Id $PID).Path
        if (-not $pwshExe) { $pwshExe = 'powershell.exe' }
        $procArgs = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $script:FlashPath,
                      '-NoElevate', '-IsoUrl', 'https://example.com/tiny.iso')
        $proc = Start-Process -FilePath $pwshExe -ArgumentList $procArgs `
                              -NoNewWindow -PassThru -Wait `
                              -RedirectStandardOutput $script:TmpOut `
                              -RedirectStandardError  $script:TmpErr
        $proc.ExitCode | Should -Be 1
        (Get-Content -LiteralPath $script:TmpErr -Raw) | Should -Match '-IsoUrl requires -Sha256'
    }

    It 'rejects -SkipVerify without -Force with a matching error' {
        $pwshExe = (Get-Process -Id $PID).Path
        if (-not $pwshExe) { $pwshExe = 'powershell.exe' }
        $procArgs = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $script:FlashPath,
                      '-NoElevate', '-IsoUrl', 'https://example.com/tiny.iso',
                      '-Sha256', ('0' * 64), '-SkipVerify')
        $proc = Start-Process -FilePath $pwshExe -ArgumentList $procArgs `
                              -NoNewWindow -PassThru -Wait `
                              -RedirectStandardOutput $script:TmpOut `
                              -RedirectStandardError  $script:TmpErr
        $proc.ExitCode | Should -Be 1
        (Get-Content -LiteralPath $script:TmpErr -Raw) | Should -Match '-SkipVerify'
    }
}
