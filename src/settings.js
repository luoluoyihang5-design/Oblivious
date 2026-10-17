const api = window.companion, $ = selector => document.querySelector(selector);
const toggles = ['alwaysOnTop', 'snapToEdge', 'launchAtLogin', 'dragAnimation', 'breathing', 'clickEffects', 'bubbleEnabled', 'quotaEnabled'];
let previewTimer;
let current, inFlight = Promise.resolve();
let quoteDraft = [], quoteEditing = 0, quoteDirty = false;
function renderQuoteList(quotes, force = false) {
  const list = $('#quote-list');
  if (!force && (quoteDirty || list.contains(document.activeElement))) return;
  quoteDraft = quotes.map(quote => ({ ...quote }));
  list.replaceChildren();
  for (const [index, quote] of quoteDraft.entries()) {
    const row = document.createElement('div'); row.className = 'quote-row'; row.dataset.quoteId = quote.id;
    const enabled = document.createElement('input'); enabled.type = 'checkbox'; enabled.checked = quote.enabled; enabled.setAttribute('aria-label', '启用第 ' + (index + 1) + ' 句');
    const text = document.createElement('input'); text.type = 'text'; text.maxLength = 160; text.value = quote.text; text.setAttribute('aria-label', '第 ' + (index + 1) + ' 句台词');
    const remove = document.createElement('button'); remove.className = 'text-button'; remove.textContent = '×'; remove.setAttribute('aria-label', '删除第 ' + (index + 1) + ' 句'); remove.dataset.removeQuote = quote.id;
    row.append(enabled, text, remove); list.append(row);
  }
  $('#quote-count').textContent = quoteDraft.length + ' 句';
  $('#add-quote').disabled = quoteDraft.length >= 100;
}
function saveQuoteList(quotes, redraw = false) {
  const revision = ++quoteEditing; quoteDirty = true;
  quoteDraft = quotes.map(quote => ({ ...quote }));
  if (redraw) renderQuoteList(quoteDraft, true);
  const snapshot = quoteDraft.map(quote => ({ ...quote }));
  void operation(() => api.update({ quotes: snapshot })).then(() => {
    if (revision !== quoteEditing) return;
    quoteDirty = false; if (current) renderQuoteList(current.quotes);
  });
}
const tabs = [...document.querySelectorAll('[data-tab]')];
function selectTab(tab, focus = false) {
  clearTimeout(previewTimer);
  $('.live-preview').dataset.previewAction = '';
  if (current) render(current);
  for (const item of tabs) {
    const active = item === tab;
    item.setAttribute('aria-selected', String(active));
    item.tabIndex = active ? 0 : -1;
    $('#' + item.getAttribute('aria-controls')).hidden = !active;
  }
  if (focus) tab.focus();
}
for (const [index, tab] of tabs.entries()) {
  tab.addEventListener('click', () => selectTab(tab));
  tab.addEventListener('keydown', event => {
    const horizontal = matchMedia('(max-width: 620px)').matches;
    const previous = horizontal ? 'ArrowLeft' : 'ArrowUp';
    const next = horizontal ? 'ArrowRight' : 'ArrowDown';
    let target;
    if (event.key === previous) target = (index + tabs.length - 1) % tabs.length;
    if (event.key === next) target = (index + 1) % tabs.length;
    if (event.key === 'Home') target = 0;
    if (event.key === 'End') target = tabs.length - 1;
    if (target !== undefined) { event.preventDefault(); selectTab(tabs[target], true); }
  });
}
const narrowNavigation = matchMedia('(max-width: 620px)');
function updateNavigationAxis() { $('[role="tablist"]').setAttribute('aria-orientation', narrowNavigation.matches ? 'horizontal' : 'vertical'); }
narrowNavigation.addEventListener('change', updateNavigationAxis);
updateNavigationAxis();
function preview() {
  if (!current) return;
  const image = $('#style-preview');
  image.style.width = image.style.height = $('#size').value + 'px';
  image.style.opacity = Number($('#opacity').value) / 100;
}
function status(message, error = false) { $('#status').textContent = message; $('#status').classList.toggle('error', error); }
function render(state) {
  clearTimeout(previewTimer);
  $('.live-preview').dataset.previewAction = '';
  current = state;
  document.querySelectorAll('[data-mode]').forEach(button => button.setAttribute('aria-pressed', String(state.mode === button.dataset.mode)));
  const pet = state.mode === 'pet';
  $('#size-label').textContent = pet ? '桌宠尺寸' : '悬浮球尺寸';
  $('#size').min = pet ? '96' : '48'; $('#size').max = pet ? '280' : '128';
  $('#size').value = pet ? state.petSize : state.orbSize;
  $('#size-value').textContent = $('#size').value + ' px';
  $('#opacity').value = Math.round((pet ? state.petOpacity : state.orbOpacity) * 100); $('#opacity-value').textContent = $('#opacity').value + '%';
  for (const key of toggles) $('#' + key).checked = state[key];
  $('#quoteDoubleAction').value = state.quoteDoubleAction || 'next';
  $('#bubbleSeconds').value = state.bubbleSeconds ?? 5;
  renderQuoteList(state.quotes || []);
  for (const key of ['aboutAuthor', 'aboutContact', 'aboutWebsite']) if (document.activeElement !== $('#' + key)) $('#' + key).value = state[key] || '';
  $('#test-usage').disabled = !state.quotaEnabled;
  $('#launchAtLogin').disabled = !['win32', 'darwin'].includes(state.platform) || !state.packaged;
  $('#startup-note').textContent = '登录启动需要打包后的 Windows 或 macOS 版本。';
  $('#startup-note').hidden = !$('#launchAtLogin').disabled;
  $('#auto-app').hidden = !state.appPath;
  $('#choose-app').disabled = !['win32', 'darwin'].includes(state.platform);
  $('#app-path').textContent = state.appPath || '自动识别已安装的 ChatGPT';
  $('#pet-preview').src = state.customPet && state.petData ? state.petData : 'dragon-idle.gif';
  $('#pet-label').textContent = '自定义待机样式';
  $('#opacity-label').textContent = '不透明度';
  $('#dragAnimation').disabled = !pet || state.customPet;
  $('#breathing').disabled = !pet || state.customPet;
  document.querySelectorAll('[data-current-mode]').forEach(label => { label.textContent = pet ? '小龙娘桌宠' : '经典悬浮球'; });
  $('#style-preview').src = pet ? $('#pet-preview').src : 'chatgpt.png';
  $('.live-preview').classList.toggle('is-orb', !pet);
  $('#pet-behavior').hidden = !pet || state.customPet;
  $('#animation-note').hidden = !pet || !state.customPet;
  preview();
  $('#reset-pet').hidden = !state.customPet;
  if (state.saveError) status(state.saveError, true);
}
function operation(fn, success = '已保存') {
  inFlight = inFlight.catch(() => {}).then(async () => {
    try {
      const result = await fn();
      if (!result.ok) { status(result.error, true); return; }
      if (result.state) render(result.state);
      status(result.state?.saveError || result.message || success, !!result.state?.saveError);
    } catch (error) { status('操作失败：' + error.message, true); }
  });
  return inFlight;
}
document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => operation(() => api.update({ mode: button.dataset.mode }))));
for (const id of ['size', 'opacity']) {
  $('#' + id).addEventListener('input', event => { $('#' + id + '-value').textContent = event.target.value + (id === 'size' ? ' px' : '%'); preview(); });
  $('#' + id).addEventListener('change', event => {
    const patch = id === 'size' ? { [current.mode === 'pet' ? 'petSize' : 'orbSize']: Number(event.target.value) } : { [current.mode === 'orb' ? 'orbOpacity' : 'petOpacity']: Number(event.target.value) / 100 };
    void operation(() => api.update(patch));
  });
}
for (const id of toggles) $('#' + id).addEventListener('change', event => {
  const value = event.target.checked;
  void operation(() => api.update({ [id]: value }));
});
$('#import-pet').addEventListener('click', () => operation(() => api.choosePet(), '图片已导入'));
$('#reset-pet').addEventListener('click', () => operation(() => api.resetPet(), '已恢复内置形象'));
$('#auto-app').addEventListener('click', () => operation(() => api.autoApp(), '已恢复自动识别'));
$('#choose-app').addEventListener('click', () => operation(() => api.chooseApp(), '程序路径已保存'));
$('#open-app').addEventListener('click', () => operation(() => api.open()));
$('#reset-position').addEventListener('click', () => operation(() => api.resetPosition(), '挂件已回到主屏幕'));
$('#quoteDoubleAction').addEventListener('change', event => { const value = event.target.value; void operation(() => api.update({ quoteDoubleAction: value })); });
$('#bubbleSeconds').addEventListener('change', event => { const value = Number(event.target.value); void operation(() => api.update({ bubbleSeconds: value })); });
$('#quote-list').addEventListener('change', () => {
  const quotes = [...$('#quote-list').children].map(row => ({ id: row.dataset.quoteId, text: row.querySelector('[type=text]').value, enabled: row.querySelector('[type=checkbox]').checked }));
  saveQuoteList(quotes);
});
$('#quote-list').addEventListener('click', event => {
  const id = event.target.dataset.removeQuote;
  if (id) saveQuoteList(quoteDraft.filter(quote => quote.id !== id), true);
});
$('#add-quote').addEventListener('click', () => {
  saveQuoteList([...quoteDraft, { id: crypto.randomUUID(), text: '', enabled: true }], true);
  $('#quote-list .quote-row:last-child input[type=text]').focus();
});
$('#reset-quotes').addEventListener('click', () => {
  void operation(() => api.resetQuotes(), '已恢复默认，原台词已备份').then(() => { if (current) renderQuoteList(current.quotes, true); });
});
for (const key of ['aboutAuthor', 'aboutContact', 'aboutWebsite']) $('#' + key).addEventListener('change', event => {
  const value = event.target.value; void operation(() => api.update({ [key]: value }));
});
$('#refresh-info').addEventListener('click', () => operation(async () => {
  const result = await api.info();
  if (result.ok) {
    $('#runtime-info').textContent = `${result.version} · ${result.platform} ${result.arch} · Electron ${result.electron}`;
    $('#resource-info').textContent = `进程工作集合计 ${result.memoryMB} MB · CPU 合计 ${result.cpuPercent}%`;
  }
  return result;
}, '运行信息已刷新'));
$('#test-usage').addEventListener('click', () => operation(() => api.usage(), '已打开额度气泡'));
$('#open-project-home').addEventListener('click', () => operation(() => api.projectHome(), '已打开 GitHub 项目主页'));
api.onState(render); api.onStatus(({ message, error }) => status(message, error));
const result = await api.state();
if (result.ok) { render(result.state); if (result.launchError) status(result.launchError, true); }
else status(result.error, true);
