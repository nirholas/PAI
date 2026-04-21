export interface App {
  id: string
  name: string
  icon: string // emoji or SVG path
  exec?: () => void // for native apps; most will be iframe-based
  url?: string // for iframe apps
  description?: string
}

export interface Window {
  id: string
  app: App
  x: number
  y: number
  width: number
  height: number
  zIndex: number
  focused: boolean
  minimized: boolean
}

export interface Workspace {
  id: number
  name: string
  windows: Window[]
}
