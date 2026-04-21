// PAI Companion "brain" — a dictionary-based Q&A, NOT an LLM.
// Keywords map to canned replies and optional shortcut chips. The goal
// is a whimsical mascot that points users at real PAI features.

export interface Chip {
  label: string
  appId?: string
  query?: string // when set, re-ask the brain with this message
}

export interface Reply {
  text: string
  chips?: Chip[]
  mood?: 'happy' | 'curious' | 'proud' | 'thinking'
}

interface Rule {
  keywords: string[] // lowercased tokens; match if ANY is present
  reply: Reply
}

const RULES: Rule[] = [
  {
    keywords: ['hi', 'hello', 'hey', 'yo', 'hola', 'greetings'],
    reply: {
      text:
        "Hi there! I'm the PAI companion. I can tell you about PAI or open apps for you.",
      mood: 'happy',
      chips: [
        { label: 'What is PAI?', query: 'what is pai' },
        { label: 'Show me how to flash USB', appId: 'flash' },
        { label: 'Open Terminal', appId: 'terminal' },
      ],
    },
  },
  {
    keywords: ['what is pai', 'what is this', 'about pai', 'what are you'],
    reply: {
      text:
        "PAI is a bootable Linux distribution for private, offline AI. You plug the USB into any PC, boot from it, and get a full AI workstation — no cloud, no telemetry, and nothing left behind when you unplug.",
      mood: 'proud',
      chips: [
        { label: 'How does it stay private?', query: 'privacy' },
        { label: 'What apps are included?', query: 'apps' },
        { label: 'Open About', appId: 'about' },
      ],
    },
  },
  {
    keywords: ['flash', 'usb', 'install', 'write'],
    reply: {
      text:
        "Flashing PAI writes the disk image to a USB drive. The Flash app guides you through picking an image, verifying it, and writing. Pop the drive into any x86-64 PC and boot from USB.",
      mood: 'curious',
      chips: [
        { label: 'Open Flash', appId: 'flash' },
        { label: 'Verify my image', appId: 'verify' },
        { label: 'Hardware compatibility', appId: 'hardware' },
      ],
    },
  },
  {
    keywords: ['terminal', 'shell', 'command', 'cli'],
    reply: {
      text:
        "The PAI terminal has zsh, tmux, and common developer tools ready to go. It's a full Linux shell — not a web sandbox. Want to try the preview?",
      mood: 'happy',
      chips: [{ label: 'Open Terminal', appId: 'terminal' }],
    },
  },
  {
    keywords: ['chat', 'llm', 'ollama', 'model', 'ai'],
    reply: {
      text:
        "PAI ships with Ollama, so you can run local LLMs with no internet connection. Nothing you type ever leaves your machine — your conversation stays in RAM while PAI is running.",
      mood: 'proud',
      chips: [
        { label: 'Try the Chat demo', appId: 'chat' },
        { label: 'Privacy model', appId: 'privacy' },
      ],
    },
  },
  {
    keywords: ['privacy', 'private', 'anonymous', 'track', 'telemetry'],
    reply: {
      text:
        "Privacy is PAI's whole point. The live USB is amnesic — it forgets everything on shutdown. There are no analytics on the site and no calls home from the OS. Your data stays with you.",
      mood: 'proud',
      chips: [
        { label: 'Read privacy policy', appId: 'privacy' },
        { label: 'Security model', appId: 'security' },
      ],
    },
  },
  {
    keywords: ['persist', 'save', 'keep', 'storage', 'disk'],
    reply: {
      text:
        "By default PAI is amnesic — nothing persists between boots. You can mount external storage if you want a project folder to survive a reboot, but the OS itself never touches the host disk unless you ask it to.",
      mood: 'thinking',
    },
  },
  {
    keywords: ['security', 'secure', 'encrypt', 'threat'],
    reply: {
      text:
        "PAI uses disk encryption, verified boot, and an airgap-friendly network stack. The Security app has the full threat model and what's guarded against.",
      mood: 'curious',
      chips: [{ label: 'Open Security', appId: 'security' }],
    },
  },
  {
    keywords: ['help', 'how do i', 'shortcut', 'keys'],
    reply: {
      text:
        "There's a full shortcuts app with every keybinding in PAI. Want me to open it?",
      mood: 'happy',
      chips: [{ label: 'Open Shortcuts', appId: 'shortcuts' }],
    },
  },
  {
    keywords: ['apps', 'what can', 'features', 'included'],
    reply: {
      text:
        "PAI includes a terminal, a files browser, a local AI chat, a notepad, docs, a flasher, and a verify tool — all offline. Open the Start menu in the top-left to see them all.",
      mood: 'proud',
      chips: [
        { label: 'Open Files', appId: 'files' },
        { label: 'Open Notepad', appId: 'notepad' },
        { label: 'Open Docs', appId: 'docs' },
      ],
    },
  },
  {
    keywords: ['thanks', 'thank you', 'ty'],
    reply: { text: "Anytime! I like being useful.", mood: 'happy' },
  },
  {
    keywords: ['bye', 'goodbye', 'later'],
    reply: {
      text:
        "See you around! Close the window whenever — I'll be here.",
      mood: 'happy',
    },
  },
]

const FALLBACK: Reply = {
  text:
    "I don't quite follow. Try asking about PAI, privacy, the terminal, or how to flash USB.",
  mood: 'curious',
  chips: [
    { label: 'What is PAI?', query: 'what is pai' },
    { label: 'How to flash USB', query: 'flash' },
    { label: 'What is privacy mode?', query: 'privacy' },
    { label: 'Open Terminal', appId: 'terminal' },
  ],
}

export function greet(): Reply {
  return RULES[0].reply
}

export function ask(message: string): Reply {
  const m = message.trim().toLowerCase()
  if (!m) return FALLBACK

  // Prefer exact-phrase matches first (e.g. "what is pai").
  for (const rule of RULES) {
    for (const kw of rule.keywords) {
      if (kw.includes(' ') && m.includes(kw)) return rule.reply
    }
  }
  // Fall back to single-word token matches.
  const tokens = new Set(m.split(/[^a-z]+/).filter(Boolean))
  for (const rule of RULES) {
    for (const kw of rule.keywords) {
      if (!kw.includes(' ') && tokens.has(kw)) return rule.reply
    }
  }
  return FALLBACK
}

export const brain = { ask, greet }
