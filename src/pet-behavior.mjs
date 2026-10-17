export const actions = Object.freeze({
  // Reserved for a replacement asset. Re-enable only after the new wave is approved.
  wave: { label: '招手', duration: 2400, art: 'dragon-wave.gif', enabled: false },
  sleep: { label: '休眠', duration: 7000, art: 'dragon-sleep.png' },
});
const phrases = Object.freeze({
  wave: ['我在这里。', '回来啦，今天也一起加油。'],
  sleep: ['我眯一会儿，有事叫我。'],
});
export function chooseQuote(action, custom = '', random = Math.random) {
  const lines = custom.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const pool = lines.length ? lines : (phrases[action] || ['我在，慢慢来。']);
  return pool[Math.min(pool.length - 1, Math.max(0, Math.floor(random() * pool.length)))];
}
export function bubbleBounds(anchor, area, size = { width: 310, height: 330 }) {
  const width = Math.min(size.width, area.width), height = Math.min(size.height, area.height);
  const right = area.x + area.width, bottom = area.y + area.height;
  const preferredX = anchor.x + anchor.width + 10;
  const x = preferredX + width <= right ? preferredX : anchor.x - width - 10;
  return {
    x: Math.round(Math.max(area.x, Math.min(right - width, x))),
    y: Math.round(Math.max(area.y, Math.min(bottom - height, anchor.y + anchor.height / 2 - height / 2))),
    width, height,
  };
}
