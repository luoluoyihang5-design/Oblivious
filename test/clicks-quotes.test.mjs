import test from 'node:test';
import assert from 'node:assert/strict';
import { createClickRouter } from '../src/click-router.mjs';
import { nextQuote, nextBubbleKind, defaultQuotes } from '../src/quotes.mjs';
import { normalize, patchPreferences } from '../src/model.mjs';

test('single clicks toggle once; double clicks never also dispatch single; drag cancels', () => {
  const jobs = new Map(); let id = 0, singles = 0, doubles = 0;
  const router = createClickRouter({ single: () => singles++, double: () => doubles++, schedule: callback => { jobs.set(++id, callback); return id; }, unschedule: key => jobs.delete(key) });
  router.click(); assert.equal(singles, 0);
  const fire = () => { const callbacks = [...jobs.values()]; jobs.clear(); callbacks.forEach(callback => callback()); };
  fire(); assert.equal(singles, 1);
  router.click(); router.click(); fire(); assert.equal(doubles, 1); assert.equal(singles, 1);
  router.click(); router.cancel(); fire(); assert.equal(singles, 1);
  router.click(); router.click(); router.click(); fire(); assert.equal(doubles, 2); assert.equal(singles, 2);
});
test('bubble cycle follows both settings and restarts from quota after timeout', () => {
  assert.equal(nextBubbleKind(null), 'quota');
  assert.equal(nextBubbleKind('quota'), 'quote');
  assert.equal(nextBubbleKind('quote', 'next'), 'quote');
  assert.equal(nextBubbleKind('quote', 'quota'), 'quota');
});
test('all 33 upstream quotes are retained and per-row edits preserve order', () => {
  assert.equal(defaultQuotes.length, 33);
  const quotes = defaultQuotes.map(q => ({ ...q }));
  quotes[0].enabled = false; quotes[1].text = '我的自定义句子';
  const saved = patchPreferences(normalize(), { quotes });
  assert.equal(nextQuote(saved.quotes).text, '我的自定义句子');
  assert.equal(nextQuote(saved.quotes, 'builtin-32').id, 'builtin-1');
  assert.equal(nextQuote([], 'missing').id, '');
  assert.throws(() => patchPreferences(saved, { quotes: [quotes[0], quotes[0]] }));
});
test('5 second default, old defaults migrate and custom durations are retained', () => {
  assert.equal(normalize().bubbleSeconds, 5);
  assert.equal(normalize({ version: 3, bubbleSeconds: 12 }).bubbleSeconds, 5);
  assert.equal(normalize({ version: 3, bubbleSeconds: 9 }).bubbleSeconds, 9);
  assert.equal(normalize({ version: 4, bubbleSeconds: 12 }).bubbleSeconds, 12);
  const legacy = normalize({ customQuotes: '我的第一句\n我的第二句' });
  assert.equal(legacy.quotes.length, 2); assert.equal(legacy.quotes[0].text, '我的第一句');
});
