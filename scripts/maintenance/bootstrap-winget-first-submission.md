# First Winget submission checklist

The first submission to `microsoft/winget-pkgs` requires a human review.
Subsequent updates are automated by `.github/workflows/update-winget.yml`.

## Prerequisites

- [ ] A PAI release exists with a `pai-cli-<version>.zip` asset attached.
- [ ] You have a GitHub account and can open PRs on `microsoft/winget-pkgs`.
- [ ] Install [wingetcreate](https://github.com/microsoft/winget-create):
  ```powershell
  winget install wingetcreate
  ```

## Steps

1. **Generate the manifest:**
   ```powershell
   $tag = "v0.2.0"  # Replace with actual tag
   $version = $tag -replace '^v',''
   $url = "https://github.com/nirholas/pai/releases/download/$tag/pai-cli-$version.zip"
   wingetcreate new $url --id PAI.PAI --version $version
   ```
   Review the generated files in `manifests/p/PAI/PAI/<version>/`.

2. **Validate locally:**
   ```powershell
   winget validate manifests/p/PAI/PAI/$version/
   ```

3. **Submit the PR:**
   ```powershell
   wingetcreate submit manifests/p/PAI/PAI/$version/ --token <your-github-pat>
   ```
   Or fork `microsoft/winget-pkgs`, add the manifest files, and open a PR
   manually.

4. **Wait for review.** First-time package submissions typically take
   1–3 business days. The `winget-pkgs` bots run automated validation
   (manifest schema, installer download, hash checks). A human moderator
   does a final review.

5. **After approval:** `winget install PAI.PAI` will work. Future
   releases are handled automatically by the `update-winget.yml` workflow
   using `vedantmgoyal9/winget-releaser`.

## Troubleshooting

- **Validation failures:** Check that `InstallerSha256` matches the
  actual SHA256 of the `.zip` asset and that the URL is publicly
  accessible.
- **Stale cache:** Users may need `winget source update` to see new
  packages.
- **Review delayed:** Comment on the PR politely asking for review after
  ~5 business days.

## References

- [winget-pkgs contribution guide](https://github.com/microsoft/winget-pkgs/blob/master/CONTRIBUTING.md)
- [Manifest schema reference](https://learn.microsoft.com/en-us/windows/package-manager/package/manifest)
- [winget-create docs](https://github.com/microsoft/winget-create)
