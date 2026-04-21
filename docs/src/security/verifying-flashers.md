---
title: "Verifying PAI flasher signatures"
description: "How to verify the Authenticode signature on PAI's flash.ps1 before running it."
---

# Verifying PAI flasher signatures

PAI's PowerShell flashers are Authenticode-signed by SignPath under the publisher
name "Open Source Developer, PAI" (SignPath's OSS program uses this
convention). Verify before running:

```powershell
$sig = Get-AuthenticodeSignature .\flash.ps1
$sig.Status                    # Must be: Valid
$sig.SignerCertificate.Subject  # Must contain: PAI / publisher name
```

If the status is anything other than `Valid`, do not run the script. Report
the issue at <https://github.com/nirholas/pai/security/advisories>.

## The signature chain

PAI's code-signing certificate chains to a root in the Microsoft Trusted Root
Program, so Windows recognizes it without manual trust. The certificate
thumbprint is listed at <https://pai.direct/security/signing>. (See also our
transparency log of all signed releases.)

## Why this matters

When Windows runs a downloaded script, SmartScreen checks its reputation. An
unsigned script triggers red warnings; a signed script with a recognized
publisher passes silently. This doesn't just improve UX — it gives you a
cryptographic guarantee that the script you're about to run is the exact file
we released.

## Signature transparency

Every release's signed artifacts are listed at
<https://pai.direct/security/signing> with timestamp, SHA256, and a pointer to
the SignPath audit log entry. If you find a release we didn't publish, open a
security advisory.
