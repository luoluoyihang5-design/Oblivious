import { defaultQuotes, normalizeQuotes } from './quotes.mjs';
// Preferences and geometry use device-independent pixels.
export const defaults = Object.freeze({
  version: 4, mode: 'pet', orbSize: 76, petSize: 180, opacity: 1,
  orbOpacity: 1, petOpacity: 1, alwaysOnTop: true, snapToEdge: true,
  launchAtLogin: false, dragAnimation: false, breathing: true,
  dockEdge: null, position: null, customPet: false, appPath: '',
  idleActions: false, clickEffects: true, bubbleEnabled: true, quotaEnabled: true,
  autoSleepEnabled: false, autoSleepMinutes: 5,
  bubbleSeconds: 5, customQuotes: '', quoteDoubleAction: 'next', quotes: defaultQuotes,
  aboutAuthor: '琉璃kisaki', aboutContact: 'b站 琉璃kisaki · liulikisaki@gmail.com', aboutWebsite: 'https://github.com/luoluoyihang5-design/Oblivious',
});
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
export function normalize(raw = {}) {
  if (!raw || typeof raw !== 'object') raw = {};
  const result = { ...defaults };
  if (raw.mode === 'orb' || raw.mode === 'pet') result.mode = raw.mode;
  for (const key of ['orbOpacity', 'petOpacity']) result[key] = typeof raw.opacity === 'number' && Number.isFinite(raw.opacity) ? clamp(raw.opacity, .2, 1) : 1;
  for (const [key, min, max] of [['orbSize', 48, 128], ['petSize', 96, 280], ['opacity', .2, 1], ['orbOpacity', .2, 1], ['petOpacity', .2, 1], ['bubbleSeconds', 1, 60]]) {
    if (typeof raw[key] === 'number' && Number.isFinite(raw[key])) result[key] = clamp(raw[key], min, max);
  }
  if ((raw.version ?? 0) < 4 && raw.bubbleSeconds === 12) result.bubbleSeconds = 5;
  for (const key of ['alwaysOnTop', 'snapToEdge', 'launchAtLogin', 'dragAnimation', 'breathing', 'customPet', 'idleActions', 'clickEffects', 'bubbleEnabled', 'quotaEnabled']) if (typeof raw[key] === 'boolean') result[key] = raw[key];
  if (['next', 'quota'].includes(raw.quoteDoubleAction)) result.quoteDoubleAction = raw.quoteDoubleAction;
  result.quotes = normalizeQuotes(raw.quotes);
  if (typeof raw.customQuotes === 'string') result.customQuotes = raw.customQuotes.slice(0, 6000).split(/\r?\n/).map(line => line.slice(0, 160)).join('\n');
  if (!Array.isArray(raw.quotes) && result.customQuotes.trim()) result.quotes = result.customQuotes.split(/\r?\n/).filter(line => line.trim()).map((text, index) => ({ id: 'migrated-' + index, text, enabled: true }));
  for (const key of ['aboutAuthor', 'aboutContact', 'aboutWebsite']) if (typeof raw[key] === 'string' && raw[key].trim()) result[key] = raw[key].slice(0, 200);
  if (result.snapToEdge && ['left', 'right'].includes(raw.dockEdge)) result.dockEdge = raw.dockEdge;
  if (typeof raw.appPath === 'string' && raw.appPath.length <= 4096) result.appPath = raw.appPath;
  if (raw.position && Number.isFinite(raw.position.x) && Number.isFinite(raw.position.y)) result.position = { x: Math.round(raw.position.x), y: Math.round(raw.position.y) };
  // Retain the old key for preference compatibility, but never re-enable random actions.
  result.idleActions = false;
  result.autoSleepEnabled = typeof raw.autoSleepEnabled === 'boolean' ? raw.autoSleepEnabled : false;
  result.autoSleepMinutes = typeof raw.autoSleepMinutes === 'number' && Number.isFinite(raw.autoSleepMinutes) ? Math.round(clamp(raw.autoSleepMinutes, 1, 1440)) : 5;
  return result;
}
export function patchPreferences(current, patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new Error('设置格式不正确');
  const numeric = ['orbSize', 'petSize', 'opacity', 'orbOpacity', 'petOpacity', 'bubbleSeconds', 'autoSleepMinutes'];
  const allowed = ['mode', ...numeric, 'autoSleepEnabled', 'alwaysOnTop', 'snapToEdge', 'launchAtLogin', 'dragAnimation', 'breathing', 'idleActions', 'clickEffects', 'bubbleEnabled', 'quotaEnabled', 'quoteDoubleAction', 'quotes', 'customQuotes', 'aboutAuthor', 'aboutContact', 'aboutWebsite'];
  if (Object.keys(patch).some(key => !allowed.includes(key))) throw new Error('不支持的设置项');
  for (const [key, value] of Object.entries(patch)) {
    if (['aboutAuthor', 'aboutContact', 'aboutWebsite'].includes(key)) {
      if (typeof value !== 'string' || value.length > 200) throw new Error('关于信息过长');
      continue;
    }
    if (key === 'quotes') {
      if (!Array.isArray(value) || value.length > 100 || value.some(quote => !quote || typeof quote.text !== 'string' || quote.text.length > 160 || typeof quote.enabled !== 'boolean') || normalizeQuotes(value).length !== value.length) throw new Error('台词列表格式不正确');
      continue;
    }
    if (key === 'mode' ? !['orb', 'pet'].includes(value) : key === 'quoteDoubleAction' ? !['next', 'quota'].includes(value) : key === 'customQuotes' ? typeof value !== 'string' || value.length > 6000 : numeric.includes(key) ? typeof value !== 'number' || !Number.isFinite(value) : typeof value !== 'boolean') throw new Error('设置值不正确');
  }
  const merged = { ...current, ...patch };
  if ('opacity' in patch) merged[current.mode === 'orb' ? 'orbOpacity' : 'petOpacity'] = patch.opacity;
  return normalize(merged);
}
export const activeOpacity = prefs => prefs.mode === 'orb' ? prefs.orbOpacity : prefs.petOpacity;
export function windowSize(prefs, edge = prefs.dockEdge) {
  const size = Math.round(prefs.mode === 'orb' ? prefs.orbSize : prefs.petSize);
  if (edge && prefs.mode === 'orb') { const icon = Math.max(64, 2 * Math.round(size * .72 / 2)); return { width: Math.ceil(icon / 2), height: icon }; }
  if (edge && prefs.mode === 'pet' && !prefs.customPet) { const peek = Math.round(size * .88); return { width: Math.round(peek * 287 / 341), height: peek }; }
  return { width: size + 16, height: (prefs.mode === 'orb' ? size : Math.round(size * 1.18)) + 16 };
}
export function place(position, size, workArea, snap = false) {
  let x = clamp(Math.round(position.x), workArea.x, workArea.x + Math.max(0, workArea.width - size.width));
  const y = clamp(Math.round(position.y), workArea.y, workArea.y + Math.max(0, workArea.height - size.height));
  const right = workArea.x + Math.max(0, workArea.width - size.width);
  if (snap && Math.min(x - workArea.x, right - x) < 28) x = x - workArea.x < right - x ? workArea.x : right;
  return { x, y, width: size.width, height: size.height };
}
export function edgeAt(bounds, workArea, enabled = true) {
  if (!enabled) return null;
  const left = bounds.x - workArea.x;
  const right = workArea.x + workArea.width - bounds.x - bounds.width;
  return Math.min(left, right) < 28 ? (left <= right ? 'left' : 'right') : null;
}
export function dockBounds(position, prefs, workArea, edge = prefs.dockEdge) {
  const size = windowSize(prefs, edge);
  const point = edge ? { x: edge === 'left' ? workArea.x : workArea.x + workArea.width - size.width, y: position.y } : position;
  return place(point, size, workArea);
}
export function undockBounds(bounds, prefs, cursor) {
  const size = windowSize(prefs, null);
  return { ...size, x: Math.round(cursor.x - size.width / 2), y: Math.round(cursor.y - Math.min(size.height - 10, Math.max(10, cursor.y - bounds.y))) };
}
export function crossedDragThreshold(start, point) { return Math.hypot(point.x - start.x, point.y - start.y) >= 5; }
