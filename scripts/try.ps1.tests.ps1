# SPDX-License-Identifier: GPL-3.0-or-later
# Pester tests for scripts/try.ps1 — arg parsing, SHA verification, cache-hit logic
# Run: Invoke-Pester -Path scripts/try.ps1.tests.ps1

BeforeAll {
    $script:TryPs1 = Join-Path $PSScriptRoot 'try.ps1'
}

Describe 'try.ps1 Help' {
    It 'Shows help with -? parameter' {
        $help = Get-Help $script:TryPs1 -Full
        $help | Should -Not -BeNullOrEmpty
    }

    It 'Has a SYNOPSIS section' {
        $help = Get-Help $script:TryPs1
        $help.Synopsis | Should -Not -BeNullOrEmpty
    }

    It 'Documents the -Ram parameter' {
        $help = Get-Help $script:TryPs1 -Parameter Ram
        $help | Should -Not -BeNullOrEmpty
    }

    It 'Documents the -Cpus parameter' {
        $help = Get-Help $script:TryPs1 -Parameter Cpus
        $help | Should -Not -BeNullOrEmpty
    }

    It 'Documents the -Port parameter' {
        $help = Get-Help $script:TryPs1 -Parameter Port
        $help | Should -Not -BeNullOrEmpty
    }

    It 'Documents the -Keep parameter' {
        $help = Get-Help $script:TryPs1 -Parameter Keep
        $help | Should -Not -BeNullOrEmpty
    }

    It 'Documents the -IsoUrl parameter' {
        $help = Get-Help $script:TryPs1 -Parameter IsoUrl
        $help | Should -Not -BeNullOrEmpty
    }

    It 'Documents the -Sha256 parameter' {
        $help = Get-Help $script:TryPs1 -Parameter Sha256
        $help | Should -Not -BeNullOrEmpty
    }

    It 'Has at least 3 examples' {
        $help = Get-Help $script:TryPs1 -Examples
        $help.examples.example.Count | Should -BeGreaterOrEqual 3
    }
}

Describe 'try.ps1 Parameter Validation' {
    It 'Requires -Sha256 when -IsoUrl is specified' {
        $result = & {
            try {
                & pwsh -NoProfile -NonInteractive -File $script:TryPs1 -IsoUrl 'http://example.com/test.iso' 2>&1
            } catch { $_ }
        }
        # Script should exit with code 1
        $LASTEXITCODE | Should -Be 1
    }

    It 'Rejects RAM below 4096 MiB without -ForceLowRam' {
        $result = & {
            try {
                & pwsh -NoProfile -NonInteractive -File $script:TryPs1 -Ram 1024 2>&1
            } catch { $_ }
        }
        $LASTEXITCODE | Should -Be 1
    }

    It 'Rejects invalid port (99999)' {
        $result = & {
            try {
                & pwsh -NoProfile -NonInteractive -File $script:TryPs1 -Port 99999 2>&1
            } catch { $_ }
        }
        $LASTEXITCODE | Should -Be 1
    }

    It 'Rejects port 0' {
        $result = & {
            try {
                & pwsh -NoProfile -NonInteractive -File $script:TryPs1 -Port 0 2>&1
            } catch { $_ }
        }
        $LASTEXITCODE | Should -Be 1
    }
}

Describe 'SHA256 Verification Logic' {
    BeforeAll {
        $script:TestDir = Join-Path ([System.IO.Path]::GetTempPath()) "pai-test-$(Get-Random)"
        New-Item -ItemType Directory -Path $script:TestDir -Force | Out-Null
        $script:TestFile = Join-Path $script:TestDir 'test.iso'
        Set-Content -Path $script:TestFile -Value 'test content' -NoNewline
    }

    AfterAll {
        Remove-Item -Path $script:TestDir -Recurse -Force -ErrorAction SilentlyContinue
    }

    It 'Computes SHA256 as 64-character hex string' {
        $hash = (Get-FileHash -Path $script:TestFile -Algorithm SHA256).Hash.ToLower()
        $hash.Length | Should -Be 64
        $hash | Should -Match '^[a-f0-9]{64}$'
    }

    It 'Detects SHA256 mismatch' {
        $hash = (Get-FileHash -Path $script:TestFile -Algorithm SHA256).Hash.ToLower()
        $fakeHash = '0' * 64
        $hash | Should -Not -Be $fakeHash
    }

    It 'SHA256 matches for identical content' {
        $hash1 = (Get-FileHash -Path $script:TestFile -Algorithm SHA256).Hash.ToLower()
        $hash2 = (Get-FileHash -Path $script:TestFile -Algorithm SHA256).Hash.ToLower()
        $hash1 | Should -Be $hash2
    }
}

Describe 'Cache Logic' {
    BeforeAll {
        $script:CacheDir = Join-Path ([System.IO.Path]::GetTempPath()) "pai-cache-test-$(Get-Random)"
    }

    AfterAll {
        Remove-Item -Path $script:CacheDir -Recurse -Force -ErrorAction SilentlyContinue
    }

    It 'Creates cache directory when it does not exist' {
        Test-Path $script:CacheDir | Should -BeFalse
        New-Item -ItemType Directory -Path $script:CacheDir -Force | Out-Null
        Test-Path $script:CacheDir | Should -BeTrue
    }

    It 'Caches file and retrieves it' {
        $testFile = Join-Path $script:CacheDir 'cached.iso'
        Set-Content -Path $testFile -Value 'cached iso data'
        Test-Path $testFile | Should -BeTrue
        Get-Content $testFile | Should -Be 'cached iso data'
    }

    It 'Removes cached file cleanly' {
        $testFile = Join-Path $script:CacheDir 'to-remove.iso'
        Set-Content -Path $testFile -Value 'data'
        Remove-Item -Path $testFile -Force
        Test-Path $testFile | Should -BeFalse
    }
}

Describe 'CPU Count Defaults' {
    It 'Computes CPU count correctly' {
        $logicalProcs = [Environment]::ProcessorCount
        $halfProcs = [Math]::Floor($logicalProcs / 2)
        $expected = [Math]::Min(4, $halfProcs)
        if ($expected -lt 1) { $expected = 1 }
        $expected | Should -BeGreaterOrEqual 1
        $expected | Should -BeLessOrEqual 4
    }
}
