# Windows package managers

PAI ships a lightweight CLI (`pai`) that runs on Windows via PowerShell.
You can install it with **Winget** (ships with Windows 10/11) or **Scoop**
(popular among developers).

Both give you the same `pai` command — `pai flash`, `pai try`, `pai verify`,
`pai doctor`, `pai version` — identical to the POSIX shell version on
Linux and macOS.

## Which should I use?

| | **Winget** | **Scoop** |
|---|---|---|
| Ships with Windows? | Yes (10/11) | No — install from [scoop.sh](https://scoop.sh) |
| Best for | Everyone — native, no extra tools | Developers managing many CLI tools |
| Admin required? | Sometimes (depends on installer type) | No (installs to `~/scoop`) |
| Auto-update | `winget upgrade --all` | `scoop update *` |

If you're not sure, **use Winget** — it's already on your machine.

---

## Install with Winget

```powershell
winget install PAI.PAI
```

Verify it worked:

```powershell
pai version
```

### Upgrade

```powershell
winget upgrade PAI.PAI
```

### Uninstall

```powershell
winget uninstall PAI.PAI
```

---

## Install with Scoop

First, add the PAI bucket (one-time):

```powershell
scoop bucket add pai https://github.com/nirholas/scoop-pai
```

Then install:

```powershell
scoop install pai
```

Verify it worked:

```powershell
pai version
```

### Upgrade

```powershell
scoop update pai
```

### Uninstall

```powershell
scoop uninstall pai
```

To remove the bucket too:

```powershell
scoop bucket rm pai
```

---

## What gets installed?

Both package managers install:

| File | Purpose |
|---|---|
| `pai.ps1` | PowerShell CLI — the main entry point |
| `pai.cmd` | CMD shim so `pai` works from `cmd.exe` |
| `flash.ps1` | USB flasher (called by `pai flash`) |
| `try.ps1` | VM launcher (called by `pai try`) |

The `pai` command is added to your `PATH` automatically.

## Troubleshooting

### `pai` is not recognized

Make sure the install directory is on your `PATH`. For Scoop, run
`scoop reset pai`. For Winget, close and reopen your terminal.

### Winget shows "no package found"

First-time submissions to `microsoft/winget-pkgs` require a review that
typically takes 1–3 business days. If PAI was just released, you may need
to wait. Run `winget source update` to refresh the package index.

### Execution policy blocks `pai.ps1`

The `pai.cmd` shim passes `-ExecutionPolicy Bypass` to PowerShell. If
you're calling `pai.ps1` directly, run:

```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
```
