import { actions } from './pet-behavior.mjs';
import { removeExteriorWhite } from './logo-matte.mjs';
const api = window.companion, button = document.querySelector('#mascot'), image = document.querySelector('#art');
const toast = document.querySelector('#toast');
let mode = 'orb', dockEdge = null, dragging = false, passthrough = false, alpha, toastTimer;
let current, activeAction = '', actionTimer;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const decoded = new Map();
let desiredArt, actionSerial = 0;
function prepareArt(src) {
  if (!decoded.has(src)) {
    const preload = new Image(); preload.src = src;
    decoded.set(src, preload.decode().then(() => preload));
  }
  return decoded.get(src);
}
function setArt(src) {
  desiredArt = src;
  if (image.src === src) return;
  void prepareArt(src).then(() => {
    if (desiredArt !== src) return;
    alpha = undefined; image.src = src;
    if (src.includes('?play=')) decoded.delete(src);
  }).catch(() => {
    decoded.delete(src);
    if (desiredArt === src) { toast.textContent = '动作图片加载失败'; toast.hidden = false; }
  });
}
for (const file of ['dragon-idle.gif', 'dragon-wave.gif', 'dragon-sleep.png', 'dragon-drag.gif', 'dragon-peek.gif']) {
  void prepareArt(new URL('../assets/' + file, import.meta.url).href).catch(() => {});
}
function playAction(name, feedback = true) {
  if (!Object.hasOwn(actions, name) || !current || current.isDragging) return;
  clearTimeout(actionTimer);
  activeAction = name; actionSerial++;
  render(current);
  if (feedback && current.clickEffects && !reducedMotion.matches) {
    const effect = document.querySelector('#click-effect');
    effect.classList.remove('spark'); void effect.offsetWidth; effect.classList.add('spark');
  }
  actionTimer = setTimeout(() => { activeAction = ''; render(current); }, actions[name].duration);
}
const canvas = document.createElement('canvas'), context = canvas.getContext('2d', { willReadFrequently: true });
let dockedLogo = '';
function setPass(value) {
  if (passthrough !== value) { passthrough = value; api.passThrough(value); }
}
function readAlpha() {
  alpha = undefined;
  if (!image.naturalWidth || !image.naturalHeight) return;
  canvas.width = Math.min(512, image.naturalWidth);
  canvas.height = Math.max(1, Math.round(canvas.width * image.naturalHeight / image.naturalWidth));
  if (canvas.height > 512) { canvas.width = Math.max(1, Math.round(canvas.width * 512 / canvas.height)); canvas.height = 512; }
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  alpha = context.getImageData(0, 0, canvas.width, canvas.height);
}
image.addEventListener('load', readAlpha);
function visibleAt(x, y) {
  const r = button.getBoundingClientRect();
  if (x < r.x || y < r.y || x >= r.right || y >= r.bottom) return false;
  if (mode === 'orb' && !dockEdge) return Math.hypot(x - r.x - r.width / 2, y - r.y - r.height / 2) <= r.width / 2;
  if (!alpha) return true;
  const art = image.getBoundingClientRect();
  const fit = Math.min(art.width / image.naturalWidth, art.height / image.naturalHeight);
  const w = fit * image.naturalWidth, h = fit * image.naturalHeight;
  let u = (x - art.x - (art.width - w) / 2) / w;
  if (mode === 'pet' && dockEdge === 'right') u = 1 - u;
  const px = Math.floor(u * alpha.width);
  const py = Math.floor((y - art.y - (art.height - h) / 2) / h * alpha.height);
  if (px < 0 || py < 0 || px >= alpha.width || py >= alpha.height) return false;
  return alpha.data[(py * alpha.width + px) * 4 + 3] > 12;
}
function render(state) {
  current = state;
  mode = state.mode;
  dockEdge = state.isDragging ? null : state.dockEdge;
  const petDocked = mode === 'pet' && dockEdge && !state.customPet && !activeAction;
  document.body.className = dockEdge && (mode === 'orb' || petDocked) ? 'docked ' + dockEdge : '';
  button.className = mode;
  button.classList.toggle('dragging', dragging);
  if (state.isDragging || mode !== 'pet' || state.customPet) { activeAction = ''; clearTimeout(actionTimer); }
  button.classList.toggle('breathing', mode === 'pet' && !dockEdge && !state.isDragging && !state.customPet && state.breathing && !activeAction);
  button.dataset.action = activeAction;
  button.classList.toggle('peeking', !!petDocked);
  const next = mode === 'orb' ? (dockEdge && dockedLogo ? dockedLogo : new URL('../assets/chatgpt.png', import.meta.url).href) :
    state.customPet && state.petData ? state.petData : new URL(
      state.isDragging ? (state.dragAnimation ? '../assets/dragon-drag.gif' : '../assets/dragon-drag.png') :
      petDocked ? '../assets/dragon-peek.gif' : activeAction && actions[activeAction].art ? '../assets/' + actions[activeAction].art : '../assets/dragon-idle.gif', import.meta.url).href;
  setArt(activeAction && actions[activeAction].art?.endsWith('.gif') ? next + '?play=' + actionSerial : next);
  image.alt = mode === 'orb' ? 'ChatGPT' : petDocked ? '知知从边缘探头' : '小龙娘桌宠';
  button.title = '单击唤起 / 收起 ChatGPT · 双击切换额度与台词 · 拖动移动 · 右键菜单';
  button.setAttribute('aria-label', button.title);
  setPass(false);
}
const logo = new Image();
logo.onload = () => {
  const c = document.createElement('canvas'); c.width = logo.naturalWidth; c.height = logo.naturalHeight;
  const ctx = c.getContext('2d'); ctx.drawImage(logo, 0, 0);
  const pixels = ctx.getImageData(0, 0, c.width, c.height);
  pixels.data.set(removeExteriorWhite(pixels)); ctx.putImageData(pixels, 0, 0);
  dockedLogo = c.toDataURL('image/png');
  if (current) render(current);
};
logo.src = new URL('../assets/chatgpt.png', import.meta.url).href;
const hover = event => { if (!dragging) setPass(!visibleAt(event.clientX, event.clientY)); };
window.addEventListener('pointermove', hover);
// Electron forwards mousemove (not pointermove) through ignored transparent windows.
window.addEventListener('mousemove', hover);
button.addEventListener('pointerdown', event => {
  if (event.button !== 0 || !visibleAt(event.clientX, event.clientY)) return;
  dragging = true; setPass(false); button.classList.add('dragging');
  button.setPointerCapture(event.pointerId); api.dragStart({ x: event.screenX, y: event.screenY }); event.preventDefault();
});
function finish(event, cancel) {
  if (!dragging) return;
  dragging = false; button.classList.remove('dragging'); api.dragEnd(cancel, cancel ? undefined : { x: event.screenX, y: event.screenY });
  if (button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId);
}
button.addEventListener('pointerup', event => finish(event, false));
button.addEventListener('pointercancel', event => finish(event, true));
button.addEventListener('lostpointercapture', event => finish(event, true));
button.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); void api.open(); } });
window.addEventListener('contextmenu', event => { event.preventDefault(); if (visibleAt(event.clientX, event.clientY)) api.menu(); });
api.onState(render);
api.onAction(({ name }) => playAction(name));
document.addEventListener('visibilitychange', () => { if (document.hidden) { clearTimeout(actionTimer); activeAction = ''; } else if (current) render(current); });
reducedMotion.addEventListener('change', () => { if (current) render(current); });
api.onStatus(({ message }) => {
  toast.textContent = message; toast.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast.hidden = true; }, 3200);
});
const result = await api.state(); if (result.ok) render(result.state);
if (result.ok) {
  const greeting = await api.greeting();
  if (greeting.ok && greeting.action) playAction(greeting.action, false);
}
