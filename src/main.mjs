import { app, BrowserWindow, ipcMain, Menu, Tray, screen, nativeImage, dialog, shell } from 'electron';
import { readFile, writeFile, mkdir, rename, stat, realpath } from 'node:fs/promises';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaults, normalize, patchPreferences, place, windowSize, crossedDragThreshold, activeOpacity, edgeAt, dockBounds, undockBounds } from './model.mjs';
import { actions, bubbleBounds } from './pet-behavior.mjs';
import { nextQuote, nextBubbleKind, defaultQuotes } from './quotes.mjs';
import { createClickRouter } from './click-router.mjs';
import { createUsageService } from './usage-service.mjs';
import { controlChatGPT, loginSettings } from './platform.mjs';
import { initialBubbleSize, fitBubbleSize } from './bubble-layout.mjs';
import { createAutoSleep } from './auto-sleep.mjs';
import { preferenceEffects } from './preference-effects.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const asset = name => join(here, '../assets', name);
const packageInfo = JSON.parse(await readFile(join(here, '../package.json'), 'utf8'));
app.setName('ChatGPT Companion');
const locked = app.requestSingleInstanceLock();
if (!locked) app.quit();
let orb, settings, tray, prefs = { ...defaults }, petData = '', drag, dragTimer, persistTimer;
let queue = Promise.resolve(), busy = false, saveError = '';
let bubble, bubbleData, bubbleTimer, lastQuoteId = '', bubbleRevision = 0, greetingPending = true;
let bubbleSize = initialBubbleSize(), bubbleLayoutRevision = 0;
let petMenuOpen = false, pendingMenuAction;
const autoSleep = createAutoSleep({
  onSleep: broadcastState,
  onWake: broadcastState,
});
function syncAutoSleep() {
  autoSleep.configure({ enabled: prefs.autoSleepEnabled, minutes: prefs.autoSleepMinutes,
    eligible: !!(isAlive(orb) && orb.isVisible() && prefs.mode === 'pet' && !prefs.customPet && !drag && !petMenuOpen) });
}
const clicks = createClickRouter({
  single: () => { void openChatGPT('toggle').catch(() => {}); },
  double: () => { advanceBubble(); },
});
const refreshUsage = createUsageService();
function positionBubble() {
  if (!isAlive(bubble) || !isAlive(orb)) return;
  const anchor = orb.getBounds();
  bubble.setBounds(bubbleBounds(anchor, currentArea({ x: anchor.x + anchor.width / 2, y: anchor.y + anchor.height / 2 }), bubbleSize));
  bubble.setAlwaysOnTop(prefs.alwaysOnTop, 'floating');
}
function hideBubble() {
  bubbleRevision++;
  bubbleData = undefined;
  clearTimeout(bubbleTimer);
  if (isAlive(bubble)) bubble.hide();
}
function scheduleBubbleHide() {
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(hideBubble, prefs.bubbleSeconds * 1000);
}
function showBubble(data) {
  data = { ...data, quotaEnabled: prefs.quotaEnabled, bubbleEnabled: prefs.bubbleEnabled, layoutRevision: ++bubbleLayoutRevision };
  bubbleSize = initialBubbleSize(data);
  bubbleData = data;
  if (!isAlive(bubble)) {
    bubble = secureWindow({ ...bubbleSize, transparent: true, frame: false, thickFrame: false, hasShadow: false, resizable: false, skipTaskbar: true, focusable: false, show: false, title: '知知 · 气泡' });
    if (process.platform === 'darwin') bubble.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    bubble.webContents.on('did-finish-load', () => { if (bubbleData && isAlive(bubble)) bubble.webContents.send('companion:bubble', bubbleData); });
    bubble.once('ready-to-show', () => { if (bubbleData) { positionBubble(); bubble.showInactive(); } });
    bubble.on('closed', () => { bubble = undefined; });
    void bubble.loadFile(asset('bubble.html'));
  } else { bubble.webContents.send('companion:bubble', data); bubble.showInactive(); }
  positionBubble(); scheduleBubbleHide();
}
function refreshBubbleControls() {
  if (!bubbleData) return;
  bubbleData = { ...bubbleData, quotaEnabled: prefs.quotaEnabled, bubbleEnabled: prefs.bubbleEnabled, layoutRevision: ++bubbleLayoutRevision };
  if (isAlive(bubble)) bubble.webContents.send('companion:bubble', bubbleData);
}
function say() {
  if (!prefs.bubbleEnabled) return;
  bubbleRevision++;
  const quote = nextQuote(prefs.quotes, lastQuoteId);
  lastQuoteId = quote.id;
  showBubble({ kind: 'quote', text: quote.text });
}
function advanceBubble() {
  const currentKind = isAlive(bubble) && bubble.isVisible() ? bubbleData?.kind : null;
  if (nextBubbleKind(currentKind, prefs.quoteDoubleAction) === 'quote' && prefs.bubbleEnabled) say();
  else void showUsage();
}
async function showUsage() {
  if (!prefs.quotaEnabled) return;
  const revision = ++bubbleRevision;
  showBubble({ kind: 'quota', loading: true });
  clearTimeout(bubbleTimer); // Give the query time to complete before the reading timer starts.
  const result = await refreshUsage();
  if (revision !== bubbleRevision || !prefs.quotaEnabled) return;
  showBubble({ kind: 'quota', ...result });
}
function interact(name) {
  if (!Object.hasOwn(actions, name) || actions[name].enabled === false) return;
  if (petMenuOpen) { pendingMenuAction = name; return; }
  autoSleep.touch();
  if (name === 'sleep') { syncAutoSleep(); autoSleep.sleep(); return; }
  if (isAlive(orb)) orb.webContents.send('companion:action', { name });
}
const configPath = () => join(app.getPath('userData'), 'preferences.json');
const petPath = () => join(app.getPath('userData'), 'pet-image.json');
const publicState = () => ({ ...prefs, petData, sleeping: autoSleep.sleeping, isDragging: !!drag?.moved, platform: process.platform, packaged: app.isPackaged, saveError });
const isAlive = win => win && !win.isDestroyed();
function persist() {
  const data = JSON.stringify(prefs, null, 2);
  queue = queue.catch(() => {}).then(async () => {
    await mkdir(app.getPath('userData'), { recursive: true });
    await writeFile(configPath() + '.tmp', data, { mode: 0o600 });
    await rename(configPath() + '.tmp', configPath());
    saveError = '';
  }).catch(error => {
    saveError = '设置保存失败：' + error.message;
    status(saveError, true);
  });
  return queue;
}
function broadcastState() {
  for (const win of [orb, settings]) if (isAlive(win)) win.webContents.send('companion:changed', publicState());
}
function publish() {
  syncAutoSleep();
  broadcastState();
}
function status(message, error = false) {
  for (const win of [orb, settings]) if (isAlive(win)) win.webContents.send('companion:status', { message, error });
}
function secureWindow(options) {
  const win = new BrowserWindow({ ...options, webPreferences: {
    preload: join(here, 'preload.cjs'), contextIsolation: true, nodeIntegration: false,
    sandbox: true, webSecurity: true, backgroundThrottling: true,
  } });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  win.webContents.session.setPermissionCheckHandler(() => false);
  return win;
}
function currentArea(position) {
  return screen.getDisplayNearestPoint({ x: Math.round(position.x), y: Math.round(position.y) }).workArea;
}
function layout(recenter = false) {
  if (!isAlive(orb)) return;
  if (recenter) prefs.dockEdge = null;
  const size = windowSize(prefs);
  const area = screen.getPrimaryDisplay().workArea;
  const point = recenter || !prefs.position
    ? { x: area.x + area.width - size.width - 24, y: area.y + Math.round(area.height * .56) }
    : prefs.position;
  const bounds = dockBounds(point, prefs, currentArea(point));
  orb.setBounds(bounds);
  orb.setAlwaysOnTop(prefs.alwaysOnTop, 'floating');
  orb.setOpacity(activeOpacity(prefs));
  prefs.position = { x: bounds.x, y: bounds.y };
  resetPassThrough();
  positionBubble();
}
function resetPassThrough() {
  if (!isAlive(orb)) return;
  orb.setIgnoreMouseEvents(false);
  orb.webContents.send('companion:pass-reset');
}
function showOrb() {
  if (isAlive(orb)) { orb.showInactive(); resetPassThrough(); }
}
function openSettings() {
  if (process.platform === 'darwin') app.dock?.show();
  if (isAlive(settings)) { settings.show(); settings.focus(); return; }
  const area = screen.getPrimaryDisplay().workArea;
  settings = secureWindow({ width: Math.min(980, area.width - 40), height: Math.min(940, area.height - 40), minWidth: 720, minHeight: 600,
    title: 'ChatGPT 桌面伴侣 · 设置', backgroundColor: '#f6f2fb', autoHideMenuBar: true,
    icon: asset('chatgpt.ico'), show: false });
  settings.once('ready-to-show', () => settings.show());
  settings.on('closed', () => { settings = undefined; if (process.platform === 'darwin') app.dock?.hide(); });
  void settings.loadFile(asset('settings.html'));
}
function rebuildMenu() {
  if (!tray) return;
  tray.setContextMenu(Menu.buildFromTemplate(menuItems()));
}
function menuItems() {
  return [
    { label: '打开 ChatGPT', click: () => void openChatGPT('show').catch(() => {}) },
    { type: 'separator' },
    { label: 'ChatGPT 图标球', type: 'radio', checked: prefs.mode === 'orb', click: () => void update({ mode: 'orb' }) },
    { label: '小龙娘桌宠', type: 'radio', checked: prefs.mode === 'pet', click: () => void update({ mode: 'pet' }) },
    { label: '动作', enabled: prefs.mode === 'pet' && !prefs.customPet, submenu: Object.entries(actions).filter(([, action]) => action.enabled !== false).map(([name, action]) => ({ label: action.label, click: () => interact(name) })) },
    { label: '查看 Codex 额度', enabled: prefs.quotaEnabled, click: () => void showUsage() },
    { label: '说句话', enabled: prefs.bubbleEnabled, click: () => say() },
    { label: '外观与设置…', click: openSettings },
    { label: '显示挂件', click: showOrb },
    { label: '隐藏挂件（托盘中可恢复）', click: () => { hideBubble(); orb?.hide(); } },
    { label: '重置挂件位置', click: () => { layout(true); showOrb(); void persist(); publish(); } },
    { type: 'separator' },
    { label: '退出桌面伴侣', click: () => app.quit() },
  ];
}
async function update(patch) {
  const next = patchPreferences(prefs, patch);
  if (next.launchAtLogin !== prefs.launchAtLogin) {
    if (!['win32', 'darwin'].includes(process.platform) || !app.isPackaged) throw new Error('登录启动需要打包后的 Windows 或 macOS 版本');
    const options = loginSettings(process.platform, app.getPath('exe'));
    app.setLoginItemSettings({ openAtLogin: next.launchAtLogin, ...options });
    const actual = app.getLoginItemSettings(options).openAtLogin;
    if (actual !== next.launchAtLogin) throw new Error('系统未接受登录启动设置');
  }
  const effects = preferenceEffects(prefs, next, bubbleData);
  if (effects.layout) { stopDrag(true); clicks.cancel(); }
  next.position = prefs.position;
  prefs = next;
  if (effects.hideBubble) hideBubble();
  else if (effects.refreshBubble) refreshBubbleControls();
  if (effects.layout) layout();
  if (effects.rescheduleBubble) scheduleBubbleHide();
  await persist();
  if (effects.menu) rebuildMenu();
  publish();
  return { state: publicState() };
}
async function openChatGPT(action = 'toggle') {
  if (busy) return { message: '正在启动 ChatGPT…' };
  busy = true;
  try {
    const code = await controlChatGPT({ action, appPath: prefs.appPath, sourceDir: here });
    lastLaunchError = '';
    const message = ({ minimized: 'ChatGPT 已收起', restored: 'ChatGPT 已唤起', launched: '正在启动 ChatGPT…',
      'restored-no-focus': '已恢复 ChatGPT，但系统未允许自动切换焦点' })[code] || '已发送打开请求';
    status(message);
    return { message };
  } catch (error) {
    const raw = String(error.stderr || error.message);
    const message = raw.includes('没有找到 ChatGPT') ? '没有找到 ChatGPT。请先安装桌面端，或在设置里选择 ChatGPT.exe。' :
      raw.includes('程序不存在') ? 'ChatGPT 程序路径已失效，请在设置中重新选择。' :
      process.platform === 'darwin' ? '无法控制 ChatGPT，请安装 macOS 客户端，或在设置中选择 ChatGPT.app。' : '无法控制 ChatGPT，请确认客户端已安装、未以管理员权限运行，且 PowerShell 可用。';
    openSettings();
    // Settings may still be loading: its state carries the last error too.
    lastLaunchError = message;
    settings?.webContents.once('did-finish-load', () => status(message, true));
    status(message, true);
    throw new Error(message);
  } finally { busy = false; }
}
let lastLaunchError = '';
function pointerPosition(point) {
  return point && Number.isFinite(point.x) && Number.isFinite(point.y) && Math.abs(point.x) < 1000000 && Math.abs(point.y) < 1000000
    ? { x: Math.round(point.x), y: Math.round(point.y) } : screen.getCursorScreenPoint();
}
function stopDrag(cancel = false, pointer) {
  clearInterval(dragTimer); dragTimer = undefined;
  if (!drag) return;
  const active = drag; drag = undefined;
  autoSleep.touch(); syncAutoSleep();
  if (!isAlive(orb)) return;
  const point = pointerPosition(pointer);
  // Mouseup can arrive before the 16ms poll, especially on a short quick drag.
  // Use event endpoints rather than turning that gesture into a normal click.
  const quickDrag = !cancel && crossedDragThreshold(active.cursor, point);
  if (active.moved || quickDrag) {
    clicks.cancel(); hideBubble();
    if (!active.moved && prefs.dockEdge) { active.bounds = undockBounds(active.bounds, prefs, active.cursor); prefs.dockEdge = null; }
    const bounds = { ...windowSize(prefs, null), x: active.bounds.x + point.x - active.cursor.x, y: active.bounds.y + point.y - active.cursor.y };
    const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
    const area = currentArea(center);
    prefs.dockEdge = edgeAt(bounds, area, prefs.snapToEdge);
    const next = dockBounds(bounds, prefs, area);
    orb.setBounds(next);
    prefs.position = { x: next.x, y: next.y };
    void persist(); publish();
  } else if (!cancel && !crossedDragThreshold(active.cursor, point)) {
    clicks.click();
  }
}
function startDrag(pointer) {
  stopDrag(true);
  autoSleep.touch();
  if (!isAlive(orb)) return;
  resetPassThrough();
  drag = { cursor: pointerPosition(pointer), bounds: orb.getBounds(), moved: false, start: Date.now() };
  syncAutoSleep();
  dragTimer = setInterval(() => {
    if (!drag || !isAlive(orb)) return stopDrag(true);
    if (Date.now() - drag.start > 60000) return stopDrag(true);
    const point = screen.getCursorScreenPoint();
    if (!drag.moved && !crossedDragThreshold(drag.cursor, point)) return;
    if (!drag.moved) {
      clicks.cancel(); hideBubble();
      if (prefs.dockEdge) {
        drag.bounds = undockBounds(drag.bounds, prefs, drag.cursor);
        prefs.dockEdge = null;
      }
      drag.moved = true; publish();
    }
    const next = { ...windowSize(prefs), x: drag.bounds.x + point.x - drag.cursor.x, y: drag.bounds.y + point.y - drag.cursor.y };
    orb.setBounds(next);
  }, 16);
}
const from = (event, kind) => (kind ? [{ orb, settings, bubble }[kind]] : [orb, settings, bubble])
  .some(win => isAlive(win) && event.sender === win.webContents && event.senderFrame === win.webContents.mainFrame);
function handle(channel, kind, fn) {
  ipcMain.handle('companion:' + channel, async (event, arg) => {
    if (!from(event, kind)) return { ok: false, error: '拒绝访问' };
    try { return { ok: true, ...await fn(arg) }; }
    catch (error) { return { ok: false, error: error.message }; }
  });
}
handle('state', null, () => ({ state: publicState(), launchError: lastLaunchError }));
handle('greeting', 'orb', () => {
  const action = greetingPending && actions.wave.enabled !== false && prefs.mode === 'pet' && !prefs.customPet ? 'wave' : null;
  greetingPending = false;
  return { action };
});
handle('info', 'settings', () => {
  const metrics = app.getAppMetrics();
  return { version: packageInfo.version, platform: process.platform, arch: process.arch, electron: process.versions.electron,
    memoryMB: Math.round(metrics.reduce((sum, item) => sum + (item.memory?.workingSetSize || 0), 0) / 1024),
    cpuPercent: Number(metrics.reduce((sum, item) => sum + (item.cpu?.percentCPUUsage || 0), 0).toFixed(1)) };
});
handle('reset-quotes', 'settings', async () => {
  await mkdir(app.getPath('userData'), { recursive: true });
  await writeFile(join(app.getPath('userData'), 'quotes-backup-' + Date.now() + '.json'), JSON.stringify(prefs.quotes, null, 2), { mode: 0o600 });
  lastQuoteId = ''; return update({ quotes: defaultQuotes.map(quote => ({ ...quote })) });
});
handle('usage', 'settings', async () => { if (!prefs.quotaEnabled) throw new Error('请先开启额度气泡'); await showUsage(); return {}; });
handle('project-home', 'settings', async () => {
  await shell.openExternal('https://github.com/luoluoyihang5-design/Oblivious');
  return {};
});
handle('bubble-size', 'bubble', size => {
  if (!bubbleData || size?.revision !== bubbleData.layoutRevision || !Number.isFinite(size.width) || !Number.isFinite(size.height)) return {};
  const anchor = orb.getBounds();
  const area = currentArea({ x: anchor.x + anchor.width / 2, y: anchor.y + anchor.height / 2 });
  const next = fitBubbleSize(size, area);
  if (next.width !== bubbleSize.width || next.height !== bubbleSize.height) { bubbleSize = next; positionBubble(); }
  return {};
});
handle('bubble-action', 'bubble', async action => {
  if (action === 'close') { bubbleData = undefined; hideBubble(); }
  else if (action === 'quota') await showUsage();
  else if (action === 'quote') say();
  else throw new Error('未知气泡操作');
  return {};
});
handle('update', 'settings', update);
handle('open', null, () => openChatGPT('show'));
handle('reset-position', 'settings', async () => { layout(true); showOrb(); await persist(); publish(); return { state: publicState() }; });
handle('auto-app', 'settings', async () => {
  prefs.appPath = ''; await persist(); publish(); return { state: publicState() };
});
handle('choose-app', 'settings', async () => {
  if (!['win32', 'darwin'].includes(process.platform)) throw new Error('当前平台不支持选择程序');
  const mac = process.platform === 'darwin';
  const result = await dialog.showOpenDialog(settings, { title: mac ? '选择 ChatGPT.app' : '选择官方 ChatGPT.exe', properties: ['openFile'], filters: [{ name: mac ? 'macOS 应用程序' : 'Windows 应用程序', extensions: [mac ? 'app' : 'exe'] }] });
  if (result.canceled) return {};
  const path = await realpath(result.filePaths[0]);
  if (mac) {
    if (extname(path).toLowerCase() !== '.app' || !(await stat(path)).isDirectory() || !(await stat(join(path, 'Contents', 'Info.plist'))).isFile()) throw new Error('请选择有效的 .app 应用');
  } else if (extname(path).toLowerCase() !== '.exe' || !(await stat(path)).isFile()) throw new Error('请选择有效的 EXE 文件');
  prefs.appPath = path;
  await persist(); publish(); return { state: publicState() };
});
handle('choose-pet', 'settings', async () => {
  const result = await dialog.showOpenDialog(settings, { title: '选择小龙娘透明图片', properties: ['openFile'], filters: [{ name: '桌宠图片（最大 8 MB）', extensions: ['png', 'webp', 'gif', 'jpg', 'jpeg'] }] });
  if (result.canceled) return {};
  const file = result.filePaths[0], info = await stat(file);
  if (!info.isFile() || info.size > 8 * 1024 * 1024) throw new Error('图片必须小于 8 MB');
  const bytes = await readFile(file);
  if (bytes.length > 8 * 1024 * 1024) throw new Error('图片必须小于 8 MB');
  // Validate raster signatures, then decode. SVG/HTML are never imported.
  const mime = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'image/png' :
    ['GIF87a','GIF89a'].includes(bytes.subarray(0, 6).toString()) ? 'image/gif' :
    bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP' ? 'image/webp' :
    bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? 'image/jpeg' : '';
  if (!mime) throw new Error('请选择有效的 PNG、WebP、GIF 或 JPEG 图片');
  const image = nativeImage.createFromBuffer(bytes), size = image.getSize();
  if (image.isEmpty() || size.width > 8192 || size.height > 8192) throw new Error('图片无效或尺寸超过 8192 像素');
  const data = `data:${mime};base64,${bytes.toString('base64')}`;
  await mkdir(app.getPath('userData'), { recursive: true });
  await writeFile(petPath() + '.tmp', JSON.stringify({ data }), { mode: 0o600 });
  await rename(petPath() + '.tmp', petPath());
  petData = data; prefs.customPet = true; prefs.mode = 'pet';
  layout(); await persist(); publish(); rebuildMenu(); return { state: publicState() };
});
handle('reset-pet', 'settings', async () => {
  prefs.customPet = false; petData = ''; layout(); await persist(); publish(); return { state: publicState() };
});
ipcMain.on('companion:settings', event => { if (from(event, 'orb')) openSettings(); });
ipcMain.on('companion:menu', event => { if (from(event, 'orb')) {
  stopDrag(true); autoSleep.touch(); petMenuOpen = true; syncAutoSleep(); resetPassThrough();
  Menu.buildFromTemplate(menuItems()).popup({ window: orb, callback: () => {
    petMenuOpen = false; autoSleep.touch(); syncAutoSleep();
    const selected = pendingMenuAction; pendingMenuAction = undefined;
    if (selected) interact(selected);
  } });
} });
ipcMain.on('companion:activity', event => { if (from(event, 'orb')) autoSleep.touch(); });
ipcMain.on('companion:drag-start', (event, point) => { if (from(event, 'orb')) startDrag(point); });
ipcMain.on('companion:drag-end', (event, payload) => { if (from(event, 'orb')) stopDrag(payload === true || payload?.cancel === true, payload?.point); });
ipcMain.on('companion:pass-through', (event, pass) => {
  if (from(event, 'orb') && !drag && typeof pass === 'boolean') orb.setIgnoreMouseEvents(pass, { forward: true });
});
if (locked) {
  app.on('second-instance', () => { showOrb(); openSettings(); });
  app.on('window-all-closed', () => {});
  app.on('activate', showOrb);
  app.on('before-quit', () => { autoSleep.destroy(); clearInterval(dragTimer); clearTimeout(persistTimer); clicks.cancel(); hideBubble(); });
  // Prevent app.exit from racing the final atomic settings write.
  let flushed = false;
  app.on('will-quit', event => {
    if (flushed) return;
    event.preventDefault();
    stopDrag(true);
    void persist().finally(() => { flushed = true; app.quit(); });
  });
  void app.whenReady().then(async () => {
  Menu.setApplicationMenu(process.platform === 'darwin' ? Menu.buildFromTemplate([
    { role: 'appMenu' }, { role: 'editMenu' }, { role: 'windowMenu' },
  ]) : null);
  try { prefs = normalize(JSON.parse(await readFile(configPath(), 'utf8'))); } catch {}
  if (prefs.customPet) {
    try {
      if ((await stat(petPath())).size > 12 * 1024 * 1024) throw new Error('oversized');
      const saved = JSON.parse(await readFile(petPath(), 'utf8')).data;
      if (!/^data:image\/(png|webp|gif|jpeg);base64,[A-Za-z0-9+/=]+$/.test(saved) || nativeImage.createFromDataURL(saved).isEmpty()) throw new Error('invalid');
      petData = saved;
    } catch { prefs.customPet = false; }
  }
  if (['win32', 'darwin'].includes(process.platform) && app.isPackaged) prefs.launchAtLogin = app.getLoginItemSettings(loginSettings(process.platform, app.getPath('exe'))).openAtLogin;
  orb = secureWindow({ ...windowSize(prefs), transparent: true, frame: false, thickFrame: false, hasShadow: false,
    resizable: false, skipTaskbar: true, focusable: false, show: false, title: 'ChatGPT 桌面伴侣', icon: asset('chatgpt.ico') });
  layout();
  if (process.platform === 'darwin') { orb.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true }); app.dock?.hide(); }
  orb.once('ready-to-show', showOrb);
  orb.on('hide', () => { stopDrag(true); hideBubble(); syncAutoSleep(); });
  orb.on('show', syncAutoSleep);
  orb.on('move', positionBubble);
  void orb.loadFile(asset('floating.html'));
  tray = new Tray(process.platform === 'darwin' ? nativeImage.createEmpty() : nativeImage.createFromPath(asset('chatgpt.png')).resize({ width: 20, height: 20 }));
  if (process.platform === 'darwin') tray.setTitle('知知');
  tray.setToolTip('ChatGPT 桌面伴侣 · 右键设置');
  if (process.platform !== 'darwin') tray.on('click', () => { showOrb(); openSettings(); });
  rebuildMenu();
  for (const event of ['display-added', 'display-removed', 'display-metrics-changed']) {
    screen.on(event, () => { clearTimeout(persistTimer); persistTimer = setTimeout(() => { stopDrag(true); layout(); void persist(); publish(); }, 200); });
  }
  if (process.argv.includes('--settings') || !await stat(configPath()).then(() => true, () => false)) openSettings();
  });
}
