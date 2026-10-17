import { readUsage, resolveCodexExecutable, freshness } from './vendor/gpt-niang/usage.mjs';

// All callers share one live, read-only request. Nothing is persisted to disk.
export function createUsageService({ read = readUsage, resolve = resolveCodexExecutable } = {}) {
  let pending;
  return async function refresh() {
    if (pending) return pending;
    pending = (async () => {
      try {
        const executable = resolve();
        if (!executable) return { ok: false, windows: [], error: '未找到 Codex，请先安装并登录 ChatGPT 账号。' };
        const result = await read(executable);
        const observedAt = result.observedAt ?? Date.now();
        // Only forward public quota fields, never account identity or raw errors.
        return {
          ok: !!result.ok && result.queryOk !== false,
          error: result.error || '',
          planLabel: result.planLabel || '', observedAt,
          windows: result.queryOk === false ? [] : (result.windows || []).map(w => ({
            label: w.label, remaining: w.remaining, resetsAt: w.resetsAt,
            freshness: freshness(w, observedAt),
          })),
        };
      } catch { return { ok: false, windows: [], error: '额度读取失败，请检查 Codex 登录状态。' }; }
    })();
    try { return await pending; } finally { pending = undefined; }
  };
}
