// Delay a single click until a possible second click has been ruled out.
// A double click must never also toggle the ChatGPT window.
export function createClickRouter({ single, double, delay = 500, schedule = setTimeout, unschedule = clearTimeout }) {
  let pending;
  return {
    click() {
      if (pending !== undefined) {
        unschedule(pending); pending = undefined; double();
      } else {
        pending = schedule(() => { pending = undefined; single(); }, delay);
      }
    },
    cancel() { if (pending !== undefined) unschedule(pending); pending = undefined; },
  };
}
