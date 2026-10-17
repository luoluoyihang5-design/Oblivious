import test from 'node:test';
import assert from 'node:assert/strict';
import { actions, actionForVisibility, chooseQuote, bubbleBounds } from '../src/pet-behavior.mjs';
import { normalize, patchPreferences } from '../src/model.mjs';
import { createUsageService } from '../src/usage-service.mjs';
import { normalizeLimits, freshness, readUsage } from '../src/vendor/gpt-niang/usage.mjs';
import { PassThrough } from 'node:stream';
import { EventEmitter } from 'node:events';

test('only right-menu actions remain and have bounded durations', () => {
  assert.deepEqual(Object.keys(actions), ['wave', 'sleep']);
  assert.equal(actions.wave.art, 'dragon-wave.gif');
  assert.equal(actions.wave.enabled, false);
  assert.equal(actions.sleep.label, '休眠');
  for (const [key, action] of Object.entries(actions)) {
    assert.ok(action.duration >= 500 && action.duration <= 8000);
  }
  assert.equal(chooseQuote('wave', '  第一行\n\n第二行', () => .9), '第二行');
  assert.ok(chooseQuote('not-an-action').length > 0);
});
test('persistent sleep survives macOS page occlusion and clears on wake', () => {
  let action = actionForVisibility('', true, false);
  assert.equal(action, 'sleep');
  action = actionForVisibility(action, true, true);
  assert.equal(actionForVisibility(action, true, false), 'sleep');
  assert.equal(actionForVisibility(action, false, false), '');
  assert.equal(actionForVisibility('wave', false, true), '');
});
test('new preference migration, validation and quote limits', () => {
  const migrated = normalize({ version: 2, petSize: 200 });
  assert.equal(migrated.quoteDoubleAction, 'next'); assert.equal(migrated.idleActions, false);
  assert.equal(normalize({ idleActions: true }).idleActions, false);
  const changed = patchPreferences(migrated, { bubbleSeconds: 100, customQuotes: '字'.repeat(200), quotaEnabled: false, quoteDoubleAction: 'quota' });
  assert.equal(changed.bubbleSeconds, 60); assert.equal(changed.customQuotes.length, 160);
  assert.equal(normalize(JSON.parse(JSON.stringify(changed))).quotaEnabled, false);
  assert.throws(() => patchPreferences(migrated, { clickAction: 'execute' }));
  assert.throws(() => patchPreferences(migrated, { customQuotes: 'x'.repeat(6001) }));
  assert.throws(() => patchPreferences(migrated, { bubbleSeconds: NaN }));
});
test('bubble flips and clamps in positive, negative and tiny work areas', () => {
  for (const area of [{ x: 0, y: 0, width: 1920, height: 1080 }, { x: -1920, y: -300, width: 1920, height: 1080 }, { x: 0, y: 0, width: 200, height: 150 }]) {
    for (const x of [area.x, area.x + area.width - 20]) {
      const bounds = bubbleBounds({ x, y: area.y + area.height - 80, width: 100, height: 100 }, area);
      assert.ok(bounds.x >= area.x && bounds.y >= area.y);
      assert.ok(bounds.x + bounds.width <= area.x + area.width);
      assert.ok(bounds.y + bounds.height <= area.y + area.height);
    }
  }
});
test('quota displays actual durations, missing windows, Business and expiry', () => {
  const data = normalizeLimits({ rateLimits: { primary: { windowDurationMins: 43200, usedPercent: 12, resetsAt: 100 }, planType: 'go' } });
  assert.equal(data.windows.length, 1); assert.equal(data.windows[0].label, '30 天'); assert.equal(data.windows[0].remaining, 88);
  const business = normalizeLimits({ rateLimitsByLimitId: { codex: { planType: 'business', individualLimit: { limit: '100', used: '25' } } } });
  assert.equal(business.windows[0].remaining, 75); assert.equal(business.windows[0].label, '个人额度');
  assert.equal(normalizeLimits({ rateLimitsByLimitId: {}, rateLimits: { primary: { windowDurationMins: 300, usedPercent: 0 } } }).ok, false);
  assert.equal(freshness({ resetsAt: 1 }, 0, 2000), 'expired');
  assert.equal(freshness({}, 0, 200000), 'stale');
});
test('quota service shares in-flight reads and strips identity without persisting snapshots', async () => {
  let calls = 0, release;
  const refresh = createUsageService({ resolve: () => 'fake', read: async () => { calls++; await new Promise(r => { release = r; }); return { ok: true, queryOk: true, accountKey: 'secret', planLabel: 'Plus', windows: [{ label: '每周', remaining: 42 }] }; } });
  const first = refresh(), second = refresh();
  release(); const [a, b] = await Promise.all([first, second]);
  assert.equal(calls, 1); assert.deepEqual(a, b); assert.equal('accountKey' in a, false);
  const unavailable = await createUsageService({ resolve: () => null })();
  assert.equal(unavailable.ok, false); assert.deepEqual(unavailable.windows, []);
});
test('quota reader sends only initialize and account read methods, with no model call', async () => {
  const methods = [];
  const spawnProcess = () => {
    const proc = new EventEmitter();
    proc.stdin = new PassThrough(); proc.stdout = new PassThrough(); proc.stderr = new PassThrough();
    proc.kill = () => {};
    proc.stdin.on('data', bytes => {
      const request = JSON.parse(String(bytes)); methods.push(request.method);
      if (!request.id) return;
      const result = request.id === 1 ? {} : request.id === 2 ? { account: { type: 'chatgpt', email: 'test@example.invalid', planType: 'plus' } } : { rateLimits: { primary: { windowDurationMins: 300, usedPercent: 25 } } };
      queueMicrotask(() => proc.stdout.write(JSON.stringify({ id: request.id, result }) + '\n'));
    });
    return proc;
  };
  const result = await readUsage('fake', { spawnProcess });
  assert.equal(result.windows[0].remaining, 75);
  assert.deepEqual(methods, ['initialize', 'initialized', 'account/read', 'account/rateLimits/read']);
});
