export interface AppMeta {
  id: string
  title: string
  description: string
  ogImage?: string
}

export const apps: AppMeta[] = [
  {
    id: 'flash',
    title: 'Flash — PAI',
    description: 'Write PAI to a USB drive and boot a private AI workstation in minutes.',
    ogImage: '/logo/pai-logo.png',
  },
  {
    id: 'docs',
    title: 'Docs — PAI',
    description: 'Full documentation for PAI: setup, apps, security model, and hardware compatibility.',
    ogImage: '/logo/pai-logo.png',
  },
  {
    id: 'how-it-works',
    title: 'How PAI works — PAI',
    description: 'How PAI works: amnesic live USB, offline AI, hardened networking, and free software — explained.',
    ogImage: '/logo/pai-logo.png',
  },
  {
    id: 'security',
    title: 'Security — PAI',
    description: 'PAI security model: airgap, encryption, verified boot, and threat model overview.',
    ogImage: '/logo/pai-logo.png',
  },
  {
    id: 'verify',
    title: 'Verify — PAI',
    description: 'Cryptographically verify your PAI image against signed checksums before flashing.',
    ogImage: '/logo/pai-logo.png',
  },
  {
    id: 'terminal',
    title: 'Terminal — PAI',
    description: 'Full-featured terminal emulator running on PAI with zsh and common dev tools.',
    ogImage: '/logo/pai-logo.png',
  },
  {
    id: 'files',
    title: 'Files — PAI',
    description: 'Browse and manage files on your PAI USB drive with the built-in file manager.',
    ogImage: '/logo/pai-logo.png',
  },
  {
    id: 'ollama',
    title: 'Ollama — PAI',
    description: 'Run local language models on PAI with Ollama — no internet, no cloud, fully private.',
    ogImage: '/logo/pai-logo.png',
  },
  {
    id: 'settings',
    title: 'Settings — PAI',
    description: 'Configure your PAI environment: display, network, security, and app preferences.',
    ogImage: '/logo/pai-logo.png',
  },
]

export const appMap = new Map(apps.map(a => [a.id, a]))

export function getApp(id: string): AppMeta | undefined {
  return appMap.get(id)
}
