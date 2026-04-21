// Text editor app — PAI

import { bridge } from '../_bridge.js'

const LS_WRAP = 'pai-text-wrap'
const LS_LINES = 'pai-text-lines'
const LS_DRAFT = 'pai-text-draft'

interface State {
  filename: string
  dirty: boolean
  handle: any | null // FileSystemFileHandle if available
}

function loadBool(key: string, def: boolean): boolean {
  try {
    const v = localStorage.getItem(key)
    if (v === null) return def
    return v === '1'
  } catch { return def }
}
function saveBool(key: string, val: boolean) {
  try { localStorage.setItem(key, val ? '1' : '0') } catch {}
}

export function mountEditor(root: HTMLElement) {
  const ta = root.querySelector<HTMLTextAreaElement>('.txt-area')!
  const gutter = root.querySelector<HTMLElement>('.txt-gutter')!
  const body = root.querySelector<HTMLElement>('.txt-body')!
  const statusEl = root.querySelector<HTMLElement>('.txt-status')!
  const findbar = root.querySelector<HTMLElement>('.txt-findbar')!
  const findInput = root.querySelector<HTMLInputElement>('.txt-find-input')!
  const replaceInput = root.querySelector<HTMLInputElement>('.txt-replace-input')!

  const state: State = { filename: 'untitled.txt', dirty: false, handle: null }

  function updateTitle() {
    const t = (state.dirty ? '* ' : '') + state.filename + ' — Text'
    bridge.setTitle(t)
    bridge.setDirty(state.dirty)
    document.title = t
  }

  function markDirty(v: boolean) {
    if (state.dirty === v) return
    state.dirty = v
    updateTitle()
  }

  function saveDraft() {
    try { localStorage.setItem(LS_DRAFT, ta.value) } catch {}
  }

  function restoreDraft() {
    try {
      const v = localStorage.getItem(LS_DRAFT)
      if (v) ta.value = v
    } catch {}
  }

  function updateStatus() {
    const text = ta.value
    const pos = ta.selectionStart
    const before = text.slice(0, pos)
    const line = before.split('\n').length
    const col = pos - before.lastIndexOf('\n')
    const lines = text.split('\n').length
    const chars = text.length
    statusEl.textContent = `Ln ${line}, Col ${col}  ·  ${lines} lines  ·  ${chars} chars`
  }

  function renderGutter() {
    if (!body.classList.contains('with-gutter')) return
    const n = ta.value.split('\n').length || 1
    const parts = new Array(n)
    for (let i = 1; i <= n; i++) parts[i - 1] = i
    gutter.textContent = parts.join('\n')
    // sync scroll
    gutter.scrollTop = ta.scrollTop
  }

  ta.addEventListener('input', () => {
    markDirty(true)
    renderGutter()
    updateStatus()
    saveDraft()
  })
  ta.addEventListener('click', updateStatus)
  ta.addEventListener('keyup', updateStatus)
  ta.addEventListener('scroll', () => { gutter.scrollTop = ta.scrollTop })

  // ── Toolbar buttons
  const btnNew = root.querySelector<HTMLButtonElement>('[data-action="new"]')!
  const btnOpen = root.querySelector<HTMLButtonElement>('[data-action="open"]')!
  const btnSave = root.querySelector<HTMLButtonElement>('[data-action="save"]')!
  const btnWrap = root.querySelector<HTMLButtonElement>('[data-action="wrap"]')!
  const btnLines = root.querySelector<HTMLButtonElement>('[data-action="lines"]')!
  const btnFind = root.querySelector<HTMLButtonElement>('[data-action="find"]')!

  function applyWrap(on: boolean) {
    ta.classList.toggle('wrap', on)
    btnWrap.setAttribute('aria-pressed', on ? 'true' : 'false')
    saveBool(LS_WRAP, on)
  }
  function applyLines(on: boolean) {
    body.classList.toggle('with-gutter', on)
    btnLines.setAttribute('aria-pressed', on ? 'true' : 'false')
    saveBool(LS_LINES, on)
    renderGutter()
  }

  applyWrap(loadBool(LS_WRAP, true))
  applyLines(loadBool(LS_LINES, false))

  btnWrap.addEventListener('click', () => applyWrap(!ta.classList.contains('wrap')))
  btnLines.addEventListener('click', () => applyLines(!body.classList.contains('with-gutter')))

  async function doNew() {
    if (state.dirty && !confirm('Discard unsaved changes?')) return
    ta.value = ''
    state.filename = 'untitled.txt'
    state.handle = null
    markDirty(false)
    saveDraft()
    renderGutter()
    updateStatus()
    ta.focus()
  }

  async function doOpen() {
    if (state.dirty && !confirm('Discard unsaved changes?')) return
    const fsa = (window as any).showOpenFilePicker
    if (fsa) {
      try {
        const [h] = await fsa({ multiple: false })
        const file = await h.getFile()
        const text = await file.text()
        ta.value = text
        state.filename = file.name
        state.handle = h
        markDirty(false)
        renderGutter()
        updateStatus()
        saveDraft()
        return
      } catch (e) {
        // user cancel or error — fall through to input fallback if aborted
        if ((e as any)?.name === 'AbortError') return
      }
    }
    // Fallback: hidden <input type=file>
    const inp = document.createElement('input')
    inp.type = 'file'
    inp.accept = 'text/*,.txt,.md,.json,.js,.ts,.html,.css,.py'
    inp.addEventListener('change', async () => {
      const f = inp.files?.[0]
      if (!f) return
      const text = await f.text()
      ta.value = text
      state.filename = f.name
      state.handle = null
      markDirty(false)
      renderGutter()
      updateStatus()
      saveDraft()
    })
    inp.click()
  }

  async function doSave() {
    const fsa = (window as any).showSaveFilePicker
    if (state.handle && state.handle.createWritable) {
      try {
        const w = await state.handle.createWritable()
        await w.write(ta.value)
        await w.close()
        markDirty(false)
        return
      } catch {}
    }
    if (fsa) {
      try {
        const h = await fsa({
          suggestedName: state.filename,
          types: [{ description: 'Text', accept: { 'text/plain': ['.txt', '.md', '.json', '.js', '.ts', '.html', '.css'] } }],
        })
        const w = await h.createWritable()
        await w.write(ta.value)
        await w.close()
        state.handle = h
        state.filename = h.name ?? state.filename
        markDirty(false)
        return
      } catch (e) {
        if ((e as any)?.name === 'AbortError') return
      }
    }
    // Fallback: download via anchor
    const blob = new Blob([ta.value], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = state.filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    markDirty(false)
  }

  btnNew.addEventListener('click', doNew)
  btnOpen.addEventListener('click', doOpen)
  btnSave.addEventListener('click', doSave)

  // ── Find / Replace
  function openFind() {
    findbar.classList.add('open')
    findInput.focus()
    findInput.select()
  }
  function closeFind() {
    findbar.classList.remove('open')
    ta.focus()
  }

  btnFind.addEventListener('click', () => {
    if (findbar.classList.contains('open')) closeFind()
    else openFind()
  })

  function findNext(from?: number): boolean {
    const q = findInput.value
    if (!q) return false
    const start = from ?? ta.selectionEnd
    const idx = ta.value.indexOf(q, start)
    const wrapIdx = idx === -1 ? ta.value.indexOf(q, 0) : idx
    if (wrapIdx === -1) return false
    ta.focus()
    ta.setSelectionRange(wrapIdx, wrapIdx + q.length)
    updateStatus()
    return true
  }

  function replaceOne() {
    const q = findInput.value
    const r = replaceInput.value
    if (!q) return
    const sel = ta.value.substring(ta.selectionStart, ta.selectionEnd)
    if (sel === q) {
      const s = ta.selectionStart
      ta.setRangeText(r, s, ta.selectionEnd, 'end')
      markDirty(true)
      renderGutter()
    }
    findNext()
  }

  function replaceAll() {
    const q = findInput.value
    const r = replaceInput.value
    if (!q) return
    const count = (ta.value.split(q).length - 1)
    if (!count) return
    ta.value = ta.value.split(q).join(r)
    markDirty(true)
    renderGutter()
    updateStatus()
  }

  root.querySelector('[data-find="next"]')?.addEventListener('click', () => findNext())
  root.querySelector('[data-find="replace"]')?.addEventListener('click', replaceOne)
  root.querySelector('[data-find="replace-all"]')?.addEventListener('click', replaceAll)
  root.querySelector('[data-find="close"]')?.addEventListener('click', closeFind)

  findInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); findNext() }
    if (e.key === 'Escape') { e.preventDefault(); closeFind() }
  })
  replaceInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); replaceOne() }
    if (e.key === 'Escape') { e.preventDefault(); closeFind() }
  })

  // ── Keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey
    if (!mod) return
    const k = e.key.toLowerCase()
    if (k === 's') { e.preventDefault(); doSave() }
    else if (k === 'o') { e.preventDefault(); doOpen() }
    else if (k === 'n') { e.preventDefault(); doNew() }
    else if (k === 'f') { e.preventDefault(); openFind() }
    else if (k === 'h') { e.preventDefault(); openFind() }
  })

  // ── Tab key inserts two spaces
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const s = ta.selectionStart
      const eSel = ta.selectionEnd
      ta.setRangeText('  ', s, eSel, 'end')
      markDirty(true)
    }
  })

  restoreDraft()
  renderGutter()
  updateStatus()
  updateTitle()
}
