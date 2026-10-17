import source from '../assets/quotes.json' with { type: 'json' };

export const defaultQuotes = Object.freeze(source.quotes.map((quote, index) => Object.freeze({
  id: 'builtin-' + index, text: quote.text, enabled: true,
})));
export function normalizeQuotes(value) {
  if (!Array.isArray(value)) return defaultQuotes.map(quote => ({ ...quote }));
  const seen = new Set();
  return value.slice(0, 100).filter(quote => quote && typeof quote.id === 'string' && /^[\w-]{1,80}$/.test(quote.id) && !seen.has(quote.id) && seen.add(quote.id) && typeof quote.text === 'string').map(quote => ({
    id: quote.id, text: quote.text.slice(0, 160), enabled: quote.enabled !== false,
  }));
}
export function nextQuote(quotes, previousId = '') {
  const pool = quotes.filter(quote => quote.enabled && quote.text.trim());
  if (!pool.length) return { id: '', text: '还没有启用的台词，请在设置中添加。' };
  const index = pool.findIndex(quote => quote.id === previousId);
  return pool[(index + 1) % pool.length];
}
export function nextBubbleKind(currentKind, quoteDoubleAction = 'next') {
  if (currentKind === 'quota') return 'quote';
  if (currentKind === 'quote' && quoteDoubleAction === 'next') return 'quote';
  return 'quota';
}
