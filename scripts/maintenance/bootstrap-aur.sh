#!/usr/bin/env bash
# One-time AUR package creation. Run from the repo root.
# Requires: an AUR account with SSH key registered; pacman-based system for makepkg.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

for pkg in pai-cli pai-cli-git; do
    echo "Bootstrapping $pkg..."
    tmp=$(mktemp -d)
    cd "$tmp"
    git clone "ssh://aur@aur.archlinux.org/${pkg}.git" 2>/dev/null || {
        # Package doesn't exist yet — AUR will create it on first push.
        git init
        git remote add origin "ssh://aur@aur.archlinux.org/${pkg}.git"
    }
    cp -v "${REPO_ROOT}/aur-templates/${pkg}/PKGBUILD" .
    if [[ -f "${REPO_ROOT}/aur-templates/${pkg}/.SRCINFO" ]]; then
        cp -v "${REPO_ROOT}/aur-templates/${pkg}/.SRCINFO" .
    else
        makepkg --printsrcinfo > .SRCINFO
    fi
    git add PKGBUILD .SRCINFO
    git commit -m "Initial commit of ${pkg}"
    git push origin master
    cd /
    rm -rf "$tmp"
done

echo "Done. Both packages should appear on https://aur.archlinux.org shortly."
