/** @type {Array<{name:string, label:string, path:string}>} */
export const WALLPAPERS = [
  { name: 'default',  label: 'Default',  path: '/wallpapers/default.svg' },
  { name: 'midnight', label: 'Midnight', path: '/wallpapers/midnight.svg' },
  { name: 'dusk',     label: 'Dusk',     path: '/wallpapers/dusk.svg' },
];

const KEY = 'pai-wallpaper';

export function setWallpaper(name) {
  const wp = WALLPAPERS.find(w => w.name === name) ?? WALLPAPERS[0];
  document.body.style.backgroundImage = `url('${wp.path}')`;
  document.body.style.backgroundSize = 'cover';
  document.body.style.backgroundPosition = 'center';
  document.body.style.backgroundRepeat = 'no-repeat';
  document.body.style.backgroundAttachment = 'fixed';
  document.body.dataset.wallpaper = wp.name;
  localStorage.setItem(KEY, wp.name);
  document.dispatchEvent(new CustomEvent('pai:wallpaper-changed', { detail: { name: wp.name } }));
}

export function initWallpaper() {
  const saved = localStorage.getItem(KEY) ?? 'default';
  setWallpaper(saved);
}
