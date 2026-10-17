const api = window.companion;
const content = document.querySelector('#bubble-content');
const title = document.querySelector('#bubble-title');
let current;
let fitFrame;
function fitContent() {
  cancelAnimationFrame(fitFrame);
  fitFrame = requestAnimationFrame(() => {
    if (!current || !api.bubbleSize) return;
    const card = document.querySelector('.bubble');
    const header = card.querySelector('header'), footer = card.querySelector('footer');
    const style = getComputedStyle(card), bodyStyle = getComputedStyle(document.body);
    const px = value => parseFloat(value) || 0;
    let width = 328;
    if (current.kind === 'quote') {
      const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
      ctx.font = getComputedStyle(content.querySelector('.quote')).font;
      const textWidth = Math.max(...String(current.text || '').split('\n').map(line => ctx.measureText(line).width));
      width = Math.max(240, Math.min(328, Math.ceil(textWidth + 50)));
    }
    const height = Math.ceil(header.offsetHeight + content.scrollHeight + footer.offsetHeight + px(style.rowGap) * 2 +
      px(style.paddingTop) + px(style.paddingBottom) + px(style.borderTopWidth) + px(style.borderBottomWidth) + px(bodyStyle.paddingTop) + px(bodyStyle.paddingBottom));
    void api.bubbleSize({ revision: current.layoutRevision, width, height });
  });
}
const clock = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}
function render(data) {
  current = data;
  document.body.dataset.kind = data.kind;
  fitContent();
  content.replaceChildren();
  title.textContent = data.kind === 'quota' ? `Codex 额度${data.planLabel ? ' · ' + data.planLabel : ''}` : '知知';
  document.querySelector('#refresh').hidden = data.kind !== 'quota';
  document.querySelectorAll('[data-command="quota"]').forEach(button => { button.disabled = !!data.loading || data.quotaEnabled === false; });
  if (data.kind === 'quote') { content.append(node('p', 'quote', data.text)); return; }
  if (data.loading) { content.append(node('p', 'message', '正在读取额度……')); return; }
  if (!data.ok) { content.append(node('p', 'message', data.error || '当前账号未提供额度窗口。')); return; }
  for (const window of data.windows || []) {
    const expired = Number.isFinite(window.resetsAt) && window.resetsAt * 1000 <= Date.now();
    const stale = Date.now() - data.observedAt > 180000;
    const row = node('div', 'quota' + (expired ? ' expired' : window.remaining < 20 ? ' low' : ''));
    const head = node('div', 'quota-head');
    head.append(node('span', '', window.label), node('strong', '', expired ? '等待刷新' : `剩余 ${Number(window.remaining.toFixed(1))}%`));
    const meter = node('div', 'meter'), fill = node('span');
    fill.style.width = Math.max(0, Math.min(100, window.remaining)) + '%';
    meter.append(fill);
    meter.setAttribute('role', 'progressbar'); meter.setAttribute('aria-label', window.label + '剩余额度');
    if (!expired) { meter.setAttribute('aria-valuenow', String(window.remaining)); meter.setAttribute('aria-valuemin', '0'); meter.setAttribute('aria-valuemax', '100'); }
    else meter.setAttribute('aria-valuetext', '窗口已到重置时间，等待刷新');
    row.append(head, meter, node('div', 'reset', expired ? '已到重置时间，请刷新' : window.resetsAt ? `${clock.format(window.resetsAt * 1000)} 重置 · 北京时间` : '未提供重置时间'));
    if (stale) row.append(node('div', 'reset', '数据已超过 3 分钟，请刷新'));
    content.append(row);
  }
  content.append(node('div', 'source', '来源：Codex · 不代表 ChatGPT 全部模型额度'));
}
document.querySelectorAll('[data-command]').forEach(button => button.addEventListener('click', () => {
  void api.bubbleAction(button.dataset.command);
}));
document.body.addEventListener('pointerenter', () => void api.bubbleAction('hold'));
document.body.addEventListener('pointerleave', () => void api.bubbleAction('leave'));
api.onBubble(render);
new ResizeObserver(fitContent).observe(content);
window.addEventListener('resize', fitContent);
void document.fonts.ready.then(fitContent);
// Update expiry labels in a pinned/hovered bubble without querying the network.
setInterval(() => { if (current?.kind === 'quota' && current.ok && !document.hidden) render(current); }, 15000);
