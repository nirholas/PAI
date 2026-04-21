// Gallery app — PAI

const LS_IMAGES = 'pai-gallery-images'
const LS_SORT = 'pai-gallery-sort'
const MAX_BYTES = 5 * 1024 * 1024 // 5MB cap total

interface GalleryImage {
  id: string
  name: string
  src: string // URL or data: URL
  builtIn?: boolean
  addedAt: number
  size: number
}

const BUILT_IN: GalleryImage[] = [
  { id: 'b-desktop', name: 'Desktop overview', src: '/screenshots/desktop-overview.svg', builtIn: true, addedAt: 0, size: 0 },
  { id: 'b-boot', name: 'Boot screen', src: '/screenshots/boot-screen.svg', builtIn: true, addedAt: 0, size: 0 },
  { id: 'b-lock', name: 'Lock screen', src: '/screenshots/lockscreen.svg', builtIn: true, addedAt: 0, size: 0 },
  { id: 'b-waybar', name: 'Waybar workspaces', src: '/screenshots/waybar-workspaces.svg', builtIn: true, addedAt: 0, size: 0 },
  { id: 'b-neofetch', name: 'Terminal neofetch', src: '/screenshots/terminal-neofetch.svg', builtIn: true, addedAt: 0, size: 0 },
  { id: 'b-ollama', name: 'Ollama model list', src: '/screenshots/ollama-model-list.svg', builtIn: true, addedAt: 0, size: 0 },
  { id: 'b-webui', name: 'Open WebUI chat', src: '/screenshots/open-webui-chat.svg', builtIn: true, addedAt: 0, size: 0 },
  { id: 'b-flash', name: 'Flashing USB', src: '/screenshots/flashing-usb.svg', builtIn: true, addedAt: 0, size: 0 },
]

function loadUserImages(): GalleryImage[] {
  try {
    const v = localStorage.getItem(LS_IMAGES)
    return v ? JSON.parse(v) : []
  } catch { return [] }
}
function saveUserImages(list: GalleryImage[]) {
  try { localStorage.setItem(LS_IMAGES, JSON.stringify(list)) } catch (e) {
    console.warn('gallery: could not save', e)
  }
}

export function mountGallery(root: HTMLElement) {
  const grid = root.querySelector<HTMLElement>('.gal-grid')!
  const drop = root.querySelector<HTMLElement>('.gal-drop')!
  const search = root.querySelector<HTMLInputElement>('.gal-search')!
  const sortSel = root.querySelector<HTMLSelectElement>('.gal-sort')!
  const countEl = root.querySelector<HTMLElement>('.gal-count')!
  const addBtn = root.querySelector<HTMLButtonElement>('.gal-add')!
  const addInput = root.querySelector<HTMLInputElement>('.gal-file-input')!
  const lightbox = root.querySelector<HTMLElement>('.gal-lightbox')!
  const lbImg = lightbox.querySelector<HTMLImageElement>('img')!
  const lbCaption = lightbox.querySelector<HTMLElement>('.lb-caption')!

  let userImages = loadUserImages()
  let currentIdx = -1
  let currentList: GalleryImage[] = []

  function allImages(): GalleryImage[] {
    return [...BUILT_IN, ...userImages]
  }

  function render() {
    const q = search.value.trim().toLowerCase()
    const sort = sortSel.value
    let list = allImages()
    if (q) list = list.filter((i) => i.name.toLowerCase().includes(q))
    if (sort === 'name-asc') list.sort((a, b) => a.name.localeCompare(b.name))
    else if (sort === 'name-desc') list.sort((a, b) => b.name.localeCompare(a.name))
    else if (sort === 'newest') list.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0))
    else if (sort === 'oldest') list.sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0))
    currentList = list

    grid.innerHTML = ''
    if (!list.length) {
      const empty = document.createElement('div')
      empty.className = 'gal-empty'
      empty.textContent = q ? 'No matches.' : 'No images.'
      grid.appendChild(empty)
    } else {
      list.forEach((img, idx) => {
        const tile = document.createElement('div')
        tile.className = 'gal-tile'
        tile.tabIndex = 0
        tile.setAttribute('role', 'button')
        tile.setAttribute('aria-label', `Open ${img.name}`)
        const im = document.createElement('img')
        im.src = img.src
        im.alt = img.name
        im.loading = 'lazy'
        const meta = document.createElement('div')
        meta.className = 'meta'
        meta.textContent = img.name
        tile.append(im, meta)
        tile.addEventListener('click', () => openLightbox(idx))
        tile.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(idx) }
        })
        // right-click to delete user images
        if (!img.builtIn) {
          tile.addEventListener('contextmenu', (e) => {
            e.preventDefault()
            if (confirm(`Remove "${img.name}"?`)) {
              userImages = userImages.filter((x) => x.id !== img.id)
              saveUserImages(userImages)
              render()
            }
          })
        }
        grid.appendChild(tile)
      })
    }
    countEl.textContent = `${list.length} image${list.length === 1 ? '' : 's'}`
  }

  function openLightbox(idx: number) {
    if (idx < 0 || idx >= currentList.length) return
    currentIdx = idx
    const img = currentList[idx]
    lbImg.src = img.src
    lbImg.alt = img.name
    lbCaption.textContent = img.name
    lightbox.classList.add('open')
  }

  function closeLightbox() {
    lightbox.classList.remove('open')
    currentIdx = -1
  }

  function nav(delta: number) {
    if (currentIdx === -1) return
    const n = currentList.length
    const next = (currentIdx + delta + n) % n
    openLightbox(next)
  }

  lightbox.querySelector('.lb-close')!.addEventListener('click', closeLightbox)
  lightbox.querySelector('.lb-prev')!.addEventListener('click', () => nav(-1))
  lightbox.querySelector('.lb-next')!.addEventListener('click', () => nav(1))
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox()
  })
  window.addEventListener('keydown', (e) => {
    if (!lightbox.classList.contains('open')) return
    if (e.key === 'Escape') { e.preventDefault(); closeLightbox() }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); nav(-1) }
    else if (e.key === 'ArrowRight') { e.preventDefault(); nav(1) }
  })

  search.addEventListener('input', render)
  sortSel.addEventListener('change', () => {
    try { localStorage.setItem(LS_SORT, sortSel.value) } catch {}
    render()
  })
  try {
    const savedSort = localStorage.getItem(LS_SORT)
    if (savedSort) sortSel.value = savedSort
  } catch {}

  // ── File upload / drag-drop
  function addFiles(files: FileList | File[]) {
    const fileArr = Array.from(files).filter((f) => f.type.startsWith('image/'))
    const currentSize = userImages.reduce((a, b) => a + (b.size || 0), 0)
    let remaining = MAX_BYTES - currentSize
    const added: GalleryImage[] = []
    let skipped = 0

    const readNext = (i: number) => {
      if (i >= fileArr.length) {
        if (added.length) {
          userImages.push(...added)
          saveUserImages(userImages)
          render()
        }
        if (skipped > 0) alert(`${skipped} image(s) skipped — exceeds 5 MB total cap.`)
        return
      }
      const f = fileArr[i]
      if (f.size > remaining) { skipped++; readNext(i + 1); return }
      const reader = new FileReader()
      reader.onload = () => {
        const src = reader.result as string
        remaining -= f.size
        added.push({
          id: Math.random().toString(36).slice(2),
          name: f.name,
          src,
          addedAt: Date.now(),
          size: f.size,
        })
        readNext(i + 1)
      }
      reader.onerror = () => { skipped++; readNext(i + 1) }
      reader.readAsDataURL(f)
    }
    readNext(0)
  }

  addBtn.addEventListener('click', () => addInput.click())
  addInput.addEventListener('change', () => {
    if (addInput.files?.length) addFiles(addInput.files)
    addInput.value = ''
  })

  let dragDepth = 0
  root.addEventListener('dragenter', (e) => {
    e.preventDefault()
    dragDepth++
    drop.classList.add('active')
  })
  root.addEventListener('dragover', (e) => { e.preventDefault() })
  root.addEventListener('dragleave', () => {
    dragDepth--
    if (dragDepth <= 0) { drop.classList.remove('active'); dragDepth = 0 }
  })
  root.addEventListener('drop', (e) => {
    e.preventDefault()
    dragDepth = 0
    drop.classList.remove('active')
    if (e.dataTransfer?.files.length) addFiles(e.dataTransfer.files)
  })

  render()
}
