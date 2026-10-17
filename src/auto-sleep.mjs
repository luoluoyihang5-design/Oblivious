// Pet-only inactivity, never system-wide idle monitoring.
export function createAutoSleep({ now = Date.now, schedule = setTimeout, unschedule = clearTimeout, onSleep = () => {}, onWake = () => {} } = {}) {
  let enabled = false, eligible = false, minutes = 5, sleeping = false, timer, lastUsed = now();
  function clear() { if (timer !== undefined) unschedule(timer); timer = undefined; }
  function wake() { if (sleeping) { sleeping = false; onWake(); } }
  function arm() {
    clear();
    if (!enabled || !eligible || sleeping) return;
    const remaining = Math.max(0, minutes * 60000 - (now() - lastUsed));
    timer = schedule(() => { timer = undefined; if (enabled && eligible && !sleeping) { sleeping = true; onSleep(); } }, remaining);
  }
  return {
    configure(next) {
      const changed = enabled !== next.enabled || eligible !== next.eligible || minutes !== next.minutes;
      enabled = !!next.enabled; eligible = !!next.eligible; minutes = next.minutes;
      if (changed) { lastUsed = now(); wake(); arm(); }
    },
    touch() { lastUsed = now(); wake(); arm(); },
    sleep() { if (!eligible) return; clear(); if (!sleeping) { sleeping = true; onSleep(); } },
    get sleeping() { return sleeping; },
    destroy() { enabled = false; eligible = false; clear(); },
  };
}
