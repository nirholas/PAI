export const description = 'Print file contents'

const FILES = {
  'README.md': `# PAI — PAI

PAI is a bootable live-USB OS that runs AI models locally.
No cloud. No internet required. Just plug in and run.

## Quick start

1. Flash pai-0.1.0-amd64.iso to a USB drive (8 GB+ recommended)
2. Reboot and press F12 / F2 / DEL at BIOS splash
3. Select the USB drive and boot

## Included models

- llama3.2:3b    (default)
- phi3:mini      (fast, compact)

## More info

Visit https://pai.computer or read docs/ in this directory.
`,
  '.bashrc': `# PAI bash configuration

export EDITOR=nano
export TERM=xterm-256color
export OLLAMA_HOST=127.0.0.1:11434

alias ll='ls -lh'
alias la='ls -lah'
alias models='ollama list'

# PAI greeting
echo "PAI $(cat /etc/pai-version) ready."
`,
  'docs/getting-started.md': `# Getting Started with PAI

## Requirements

- USB drive, 8 GB or larger
- A computer that can boot from USB
- ~10 minutes

## Flash the image

See the Flash app at /apps/flash for guided instructions.

## First boot

The first boot takes 30–60 seconds as the system initialises.
Ollama starts automatically and loads the default model.
`,
}

export default function cat(args, _term) {
  if (!args.length) return 'Usage: cat <file>'

  const path = args[0].replace(/^~\//, '')
  const content = FILES[path]

  if (!content) {
    const dirs = ['docs', '.config']
    if (dirs.includes(path.replace(/\/$/, ''))) {
      return `cat: ${args[0]}: Is a directory`
    }
    return `cat: ${args[0]}: No such file or directory`
  }

  return content.trimEnd()
}
