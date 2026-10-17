import test from 'node:test';
import assert from 'node:assert/strict';
import { normalize, patchPreferences } from '../src/model.mjs';
import { preferenceEffects } from '../src/preference-effects.mjs';

test('editing unrelated settings preserves the visible bubble and pet position', () => {
  const current = normalize({});
  for (const patch of [{ aboutAuthor: '梦瑶' }, { autoSleepEnabled: true }, { quoteDoubleAction: 'quota' }]) {
    const next = patchPreferences(current, patch);
    assert.deepEqual(preferenceEffects(current, next, { kind: 'quote' }),
      { layout: false, menu: false, hideBubble: false, refreshBubble: false, rescheduleBubble: false });
  }
});

test('mode and bubble settings trigger only their necessary UI work', () => {
  const current = normalize({});
  assert.deepEqual(preferenceEffects(current, patchPreferences(current, { mode: 'orb' }), { kind: 'quote' }),
    { layout: true, menu: true, hideBubble: true, refreshBubble: false, rescheduleBubble: false });
  assert.equal(preferenceEffects(current, patchPreferences(current, { mode: 'orb' })).hideBubble, false);
  assert.deepEqual(preferenceEffects(current, patchPreferences(current, { bubbleEnabled: false }), { kind: 'quote' }),
    { layout: false, menu: true, hideBubble: true, refreshBubble: false, rescheduleBubble: false });
  assert.deepEqual(preferenceEffects(current, patchPreferences(current, { quotaEnabled: false }), { kind: 'quote' }),
    { layout: false, menu: true, hideBubble: false, refreshBubble: true, rescheduleBubble: false });
  assert.deepEqual(preferenceEffects(current, patchPreferences(current, { bubbleSeconds: 10 }), { kind: 'quota' }),
    { layout: false, menu: false, hideBubble: false, refreshBubble: false, rescheduleBubble: true });
  assert.equal(preferenceEffects(current, patchPreferences(current, { bubbleSeconds: 10 }), { kind: 'quota', loading: true }).rescheduleBubble, false);
});
