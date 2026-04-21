# Authenticode signing for `flash.ps1`

`scripts/flash.ps1` is currently unsigned. The public one-liner invocation
(`irm https://pai.direct/flash.ps1 | iex`) bypasses Windows' execution
policy because piped input has no file origin — signing is not required
for that path to work.

Signing would add real value for two secondary paths:

1. Users who save the script to disk and run it as `.\flash.ps1`, whose
   ExecutionPolicy is set to `AllSigned` or `RemoteSigned` without
   clearing the MOTW.
2. Users running under policy that requires signed scripts for elevated
   invocation.

## When to do this

Before the 1.0 release, or sooner if we start seeing downstream users
on locked-down Windows fleets. The moment any enterprise user reports
an ExecutionPolicy failure, promote this TODO.

## What to do

1. Acquire a code-signing certificate (Authenticode) — DigiCert, SSL.com,
   Sectigo, or an EV cert for SmartScreen reputation.
2. Sign as part of the release pipeline:
   ```powershell
   Set-AuthenticodeSignature `
     -FilePath scripts/flash.ps1 `
     -Certificate $cert `
     -TimestampServer http://timestamp.digicert.com `
     -IncludeChain All `
     -HashAlgorithm SHA256
   ```
3. Publish both signed (`flash.ps1`) and a manifest (`flash.ps1.sig.json`)
   with the expected thumbprint so users can verify out-of-band.
4. Gate the signing step on `GITHUB_REF` matching a release tag so we
   don't waste cert uses on every PR.

## Verification

Users can verify signing with:

```powershell
(Get-AuthenticodeSignature .\flash.ps1).Status
# Should print: Valid
```

## Out of scope here

This file is a placeholder. Do not sign the script in CI until the
cert material is provisioned in GitHub Actions secrets.
