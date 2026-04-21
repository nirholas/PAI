// Single source of truth for pinned-app identity used by both the Dock and the
// Start menu. Edit here to change either surface.

export const PINNED: readonly string[] = [
  'about',
  'docs',
  'flash',
  'terminal',
  'chat',
  'security',
  'verify',
  'hardware',
  'press',
  'changelog',
  'faq',
] as const

export const APP_COLORS: Record<string, string> = {
  about: '#7aa2f7',
  docs: '#4ade80',
  flash: '#fbbf24',
  terminal: '#888888',
  chat: '#9f7aea',
  security: '#f87171',
  verify: '#4ade80',
  hardware: '#f472b6',
  press: '#7aa2f7',
  changelog: '#fbbf24',
  faq: '#9f7aea',
  'how-it-works': '#7aa2f7',
  files: '#fbbf24',
  notepad: '#4ade80',
  privacy: '#f87171',
}

export function colorFor(appId: string): string {
  return APP_COLORS[appId] ?? '#7aa2f7'
}
