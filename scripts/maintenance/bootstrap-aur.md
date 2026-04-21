# Bootstrap AUR packages

One-time setup to publish `pai-cli` and `pai-cli-git` to the
[Arch User Repository](https://aur.archlinux.org/).

## Prerequisites

1. **Register an AUR account** at <https://aur.archlinux.org/register>.

2. **Generate an SSH key** (if you don't already have one for AUR):

   ```bash
   ssh-keygen -t ed25519 -C "aur" -f ~/.ssh/aur
   ```

3. **Add the public key to your AUR account**:
   - Copy `~/.ssh/aur.pub`.
   - Go to AUR → My Account → SSH Public Key → paste and save.

4. **Configure SSH** to use the key for AUR:

   ```text
   # ~/.ssh/config
   Host aur.archlinux.org
       IdentityFile ~/.ssh/aur
       User aur
   ```

5. **Verify connectivity**:

   ```bash
   ssh aur@aur.archlinux.org help
   ```

   You should see a welcome message listing available commands.

## Submitting the packages

From the repository root on an Arch-based system (or any system with
`makepkg` available):

```bash
chmod +x scripts/maintenance/bootstrap-aur.sh
./scripts/maintenance/bootstrap-aur.sh
```

The script will:

- Clone or init each package repo from `aur.archlinux.org`.
- Copy the PKGBUILD and .SRCINFO from `aur-templates/`.
- Commit and push to AUR.

After a few minutes, the packages will be visible at:

- <https://aur.archlinux.org/packages/pai-cli>
- <https://aur.archlinux.org/packages/pai-cli-git>

## Updating packages

Subsequent updates are handled automatically by the
`.github/workflows/update-aur.yml` workflow on each GitHub release.
To update manually, edit the PKGBUILD in `aur-templates/`, regenerate
`.SRCINFO` with `makepkg --printsrcinfo > .SRCINFO`, and push to the
AUR git repo.

## Secrets

The GitHub Actions workflow requires an `AUR_SSH_KEY` repository secret
containing the private SSH key whose public half is registered on the AUR
account. Add it at Settings → Secrets → Actions.
