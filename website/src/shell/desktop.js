import { wm } from './wm.js';
import { APPS, appUrl } from './apps.js';

// ── Constants ───────────────────────────────────────────────────────────────

const GRID = 96;           // px grid cell size
const ICON_W = 80;         // icon element width
const DESKTOP_PAD = 16;    // px from desktop edge to first grid origin
const CELL_OFFSET = (GRID - ICON_W) / 2; // center icon in 96px cell = 8px
const DRAG_THRESHOLD = 4;  // px before drag starts
const POSITIONS_KEY = 'pai-desktop-icons';
export const REPO_URL = 'https://github.com/nirholas/pai';

// ── App dispatch ─────────────────────────────────────────────────────────────

function openApp(appId, hash = '') {
  const id = appId.toLowerCase();
  const app = APPS[id];
  if (!app) return;
  const params = hash ? { hash: hash.replace(/^#/, '') } : undefined;
  wm.open(id, {
    title: app.title,
    w: app.default?.w,
    h: app.default?.h,
    params,
  });
}

// ── Pixel-art glyphs (8×8 bitmap → SVG rects) ───────────────────────────────

function pixelSvg(rows) {
  const px = 5; // each "pixel" = 5px on a 40×40 canvas
  const rects = rows.flatMap((row, y) =>
    [...row].map((ch, x) =>
      ch === '#'
        ? `<rect x="${x * px}" y="${y * px}" width="${px}" height="${px}"/>`
        : '',
    ),
  );
  return (
    `<svg viewBox="0 0 40 40" width="40" height="40" xmlns="http://www.w3.org/2000/svg" ` +
    `aria-hidden="true" focusable="false" fill="currentColor" ` +
    `style="image-rendering:pixelated;shape-rendering:crispEdges">` +
    rects.join('') +
    `</svg>`
  );
}

// prettier-ignore
const GLYPHS = {
  // Classic document with folded corner and text lines
  doc: pixelSvg([
    '.#####..',
    '.#...##.',
    '.#....#.',
    '.#####..',
    '.#....#.',
    '.###..#.',
    '.#....#.',
    '.######.',
  ]),
  // Open book
  book: pixelSvg([
    '.##.##..',
    '##..##..',
    '##..##..',
    '########',
    '##..##..',
    '##..##..',
    '.##.##..',
    '........',
  ]),
  // Down-arrow + base (download)
  download: pixelSvg([
    '...##...',
    '...##...',
    '...##...',
    '..####..',
    '.######.',
    '...##...',
    '.######.',
    '........',
  ]),
  // Angle brackets </> (code / github)
  code: pixelSvg([
    '...#.#..',
    '..##.##.',
    '.##...#.',
    '##.....#',
    '.##...#.',
    '..##.##.',
    '...#.#..',
    '........',
  ]),
};

// ── Icon definitions ─────────────────────────────────────────────────────────

export const ICON_DEFS = [
  {
    id: 'readme',
    label: 'README.md',
    glyph: 'doc',
    defaultCol: 0,
    defaultRow: 0,
    appId: 'docs',
    hash: 'readme',
    kind: 'Document',
    target: 'Docs → README',
    activate() { openApp('Docs', '#readme'); },
  },
  {
    id: 'getting-started',
    label: 'GET STARTED',
    glyph: 'book',
    defaultCol: 0,
    defaultRow: 1,
    appId: 'docs',
    hash: 'getting-started',
    kind: 'Document',
    target: 'Docs → Getting started',
    activate() { openApp('Docs', '#getting-started'); },
  },
  {
    id: 'download',
    label: 'DOWNLOAD',
    glyph: 'download',
    defaultCol: 1,
    defaultRow: 0,
    appId: 'flash',
    kind: 'Application',
    target: 'Flash',
    activate() { openApp('Flash'); },
  },
  {
    id: 'github',
    label: 'GITHUB \u2197',
    glyph: 'code',
    defaultCol: 1,
    defaultRow: 1,
    isExternal: true,
    href: REPO_URL,
    kind: 'External link',
    target: REPO_URL,
    activate() { window.open(REPO_URL, '_blank', 'noopener,noreferrer'); },
  },
];

/**
 * URL that "Open in new tab" should point at for a given icon.
 * For external icons, returns the external href. For internal apps,
 * returns the app's standalone route (e.g. /apps/docs?hash=readme).
 */
export function iconTabUrl(def) {
  if (def.isExternal) return def.href;
  if (!def.appId) return null;
  return appUrl(def.appId, def.hash ? { hash: def.hash } : undefined);
}

// ── Position helpers ─────────────────────────────────────────────────────────

function colRowToXY(col, row) {
  return {
    x: DESKTOP_PAD + col * GRID + CELL_OFFSET,
    y: DESKTOP_PAD + row * GRID + CELL_OFFSET,
  };
}

function loadPositions() {
  try {
    return JSON.parse(localStorage.getItem(POSITIONS_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function savePositions(positions) {
  localStorage.setItem(POSITIONS_KEY, JSON.stringify(positions));
}

function getPos(id, iconPositions) {
  if (iconPositions[id]) return iconPositions[id];
  const def = ICON_DEFS.find(d => d.id === id);
  return { col: def.defaultCol, row: def.defaultRow };
}

function isCellOccupied(col, row, excludeId, iconPositions) {
  return ICON_DEFS.some(def => {
    if (def.id === excludeId) return false;
    const pos = getPos(def.id, iconPositions);
    return pos.col === col && pos.row === row;
  });
}

function findFreeSlot(col, row, excludeId, iconPositions) {
  if (!isCellOccupied(col, row, excludeId, iconPositions)) return { col, row };
  for (let r = 0; r < 20; r++) {
    for (let c = 0; c < 20; c++) {
      if (!isCellOccupied(c, r, excludeId, iconPositions)) return { col: c, row: r };
    }
  }
  return { col, row };
}

// ── DOM helpers ──────────────────────────────────────────────────────────────

function applyPosition(el, col, row) {
  const { x, y } = colRowToXY(col, row);
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.dataset.col = col;
  el.dataset.row = row;
}

function makeIconEl(def, iconPositions) {
  const pos = getPos(def.id, iconPositions);
  const el = document.createElement('div');
  el.className = 'desktop-icon';
  el.dataset.iconId = def.id;
  el.tabIndex = 0;
  el.setAttribute('role', 'button');
  el.setAttribute(
    'aria-label',
    def.isExternal ? `${def.label} — opens in new tab` : def.label,
  );
  el.innerHTML =
    `<div class="desktop-icon__glyph">${GLYPHS[def.glyph]}</div>` +
    `<div class="desktop-icon__label">${def.label}</div>`;
  applyPosition(el, pos.col, pos.row);
  return el;
}

// ── Selection ────────────────────────────────────────────────────────────────

const selectedIds = new Set();

function selectIcon(id, exclusive = true) {
  if (exclusive) clearSelection();
  selectedIds.add(id);
  document.querySelector(`[data-icon-id="${id}"]`)?.classList.add('selected');
}

function toggleIcon(id) {
  const el = document.querySelector(`[data-icon-id="${id}"]`);
  if (selectedIds.has(id)) {
    selectedIds.delete(id);
    el?.classList.remove('selected');
  } else {
    selectedIds.add(id);
    el?.classList.add('selected');
  }
}

function clearSelection() {
  selectedIds.clear();
  document.querySelectorAll('.desktop-icon.selected').forEach(el =>
    el.classList.remove('selected'),
  );
}

// ── Drag ─────────────────────────────────────────────────────────────────────

function startDrag(e, def, iconPositions) {
  if (e.button !== 0) return;
  e.preventDefault();

  const el = e.currentTarget;
  const multiSelect = e.ctrlKey || e.metaKey;
  let dragging = false;
  const originX = e.clientX;
  const originY = e.clientY;

  // Move keyboard focus to the clicked icon so Tab/Enter continue from here.
  el.focus({ preventScroll: true });

  function onMove(ev) {
    const dx = ev.clientX - originX;
    const dy = ev.clientY - originY;
    if (!dragging && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
      dragging = true;
      el.classList.add('dragging');
    }
    if (!dragging) return;

    const desktop = document.getElementById('pai-desktop');
    const dr = desktop.getBoundingClientRect();
    const relX = ev.clientX - dr.left - DESKTOP_PAD - CELL_OFFSET;
    const relY = ev.clientY - dr.top - DESKTOP_PAD - CELL_OFFSET;
    const snapCol = Math.max(0, Math.round(relX / GRID));
    const snapRow = Math.max(0, Math.round(relY / GRID));
    applyPosition(el, snapCol, snapRow);
  }

  function onUp() {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);

    if (dragging) {
      el.classList.remove('dragging');
      const col = parseInt(el.dataset.col, 10);
      const row = parseInt(el.dataset.row, 10);
      const { col: fc, row: fr } = findFreeSlot(col, row, def.id, iconPositions);
      iconPositions[def.id] = { col: fc, row: fr };
      savePositions(iconPositions);
      applyPosition(el, fc, fr);
    } else if (multiSelect) {
      // Ctrl/Cmd+click — toggle selection, keep others
      toggleIcon(def.id);
    } else {
      // plain click — select only (double-click activates)
      selectIcon(def.id);
    }
  }

  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
}

// ── Marquee ──────────────────────────────────────────────────────────────────

function startMarquee(e) {
  if (e.button !== 0) return;
  if (e.target.closest('.desktop-icon')) return;
  if (e.target.closest('.context-menu')) return;

  const desktop = document.getElementById('pai-desktop');
  const marquee = document.getElementById('desktop-marquee');
  const dr = desktop.getBoundingClientRect();
  const sx = e.clientX - dr.left;
  const sy = e.clientY - dr.top;

  clearSelection();

  function onMove(ev) {
    const cx = ev.clientX - dr.left;
    const cy = ev.clientY - dr.top;
    const left = Math.min(sx, cx);
    const top = Math.min(sy, cy);
    const width = Math.abs(cx - sx);
    const height = Math.abs(cy - sy);

    if (width < 2 && height < 2) return;

    marquee.style.left = `${left}px`;
    marquee.style.top = `${top}px`;
    marquee.style.width = `${width}px`;
    marquee.style.height = `${height}px`;
    marquee.style.display = 'block';

    // Hit-test icons against the marquee rect
    clearSelection();
    const mRight = left + width;
    const mBottom = top + height;
    document.querySelectorAll('.desktop-icon').forEach(iconEl => {
      const ir = iconEl.getBoundingClientRect();
      const il = ir.left - dr.left;
      const it = ir.top - dr.top;
      if (!(il + ir.width < left || il > mRight || it + ir.height < top || it > mBottom)) {
        iconEl.classList.add('selected');
        selectedIds.add(iconEl.dataset.iconId);
      }
    });
  }

  function onUp() {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    marquee.style.display = 'none';
  }

  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
}

// ── Keyboard navigation ───────────────────────────────────────────────────────

let focusIdx = -1;

const ARROW_DIRS = {
  ArrowUp:    { axis: 'row', sign: -1 },
  ArrowDown:  { axis: 'row', sign:  1 },
  ArrowLeft:  { axis: 'col', sign: -1 },
  ArrowRight: { axis: 'col', sign:  1 },
};

/**
 * Find the nearest icon from the given origin in the requested direction.
 * Primary cost = distance along the movement axis; secondary cost = perpendicular
 * offset (so we prefer icons in the same row/column when moving horizontally/vertically).
 */
function findNeighbor(originCol, originRow, dir) {
  let best = null;
  let bestCost = Infinity;

  for (const def of ICON_DEFS) {
    const el = document.querySelector(`[data-icon-id="${def.id}"]`);
    if (!el) continue;
    const col = parseInt(el.dataset.col, 10);
    const row = parseInt(el.dataset.row, 10);

    let along, perp;
    if (dir.axis === 'col') {
      along = (col - originCol) * dir.sign;
      perp = row - originRow;
    } else {
      along = (row - originRow) * dir.sign;
      perp = col - originCol;
    }
    if (along <= 0) continue; // not in the requested direction

    const cost = along * 100 + Math.abs(perp); // primary: along-axis distance
    if (cost < bestCost) {
      bestCost = cost;
      best = el;
    }
  }
  return best;
}

function focusAndSelect(el) {
  if (!el) return;
  el.focus({ preventScroll: true });
  selectIcon(el.dataset.iconId);
  const icons = [...document.querySelectorAll('.desktop-icon')];
  focusIdx = icons.indexOf(el);
}

function handleDesktopKey(e) {
  const icons = [...document.querySelectorAll('.desktop-icon')];
  if (!icons.length) return;

  if (e.key === 'Tab') {
    e.preventDefault();
    focusIdx = e.shiftKey
      ? (focusIdx - 1 + icons.length) % icons.length
      : (focusIdx + 1) % icons.length;
    focusAndSelect(icons[focusIdx]);
    return;
  }

  if (e.key === 'Escape') {
    clearSelection();
    return;
  }

  const dir = ARROW_DIRS[e.key];
  if (!dir) return;

  e.preventDefault();

  // Origin = currently focused icon, or fall back to first icon in the grid.
  const currentEl =
    document.activeElement?.classList?.contains('desktop-icon')
      ? document.activeElement
      : icons[focusIdx] ?? icons[0];

  if (!currentEl) return;

  const col = parseInt(currentEl.dataset.col, 10);
  const row = parseInt(currentEl.dataset.row, 10);
  const next = findNeighbor(col, row, dir);
  if (next) focusAndSelect(next);
}

// ── Arrange (snap all icons to default grid) ─────────────────────────────────

export function arrangeIcons(iconPositions) {
  ICON_DEFS.forEach(def => {
    iconPositions[def.id] = { col: def.defaultCol, row: def.defaultRow };
    const el = document.querySelector(`[data-icon-id="${def.id}"]`);
    if (el) applyPosition(el, def.defaultCol, def.defaultRow);
  });
  savePositions(iconPositions);
}

// ── Init ─────────────────────────────────────────────────────────────────────

export function initDesktop() {
  const desktop = document.getElementById('pai-desktop');
  if (!desktop) return;

  const iconPositions = loadPositions();
  const layer = document.getElementById('desktop-icons');

  // Render icons
  ICON_DEFS.forEach(def => {
    const el = makeIconEl(def, iconPositions);

    el.addEventListener('mousedown', e => startDrag(e, def, iconPositions));

    el.addEventListener('dblclick', e => {
      e.preventDefault();
      def.activate();
    });

    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        def.activate();
        return;
      }
      if (e.key === 'Tab' || ARROW_DIRS[e.key] || e.key === 'Escape') {
        handleDesktopKey(e);
      }
    });

    el.addEventListener('focus', () => {
      focusIdx = ICON_DEFS.indexOf(def);
    });

    layer.appendChild(el);
  });

  // Desktop-level events
  desktop.addEventListener('mousedown', startMarquee);
  desktop.addEventListener('keydown', handleDesktopKey);

  desktop.addEventListener('click', e => {
    if (!e.target.closest('.desktop-icon') && !e.target.closest('.context-menu')) {
      clearSelection();
    }
  });

  // Global Escape
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      clearSelection();
      const marquee = document.getElementById('desktop-marquee');
      if (marquee) marquee.style.display = 'none';
    }
  });

  // Expose iconPositions so context-menu can call arrangeIcons
  desktop.dataset.ready = 'true';
  return iconPositions;
}
