// Keep unrelated setting changes from moving the pet or dismissing a bubble.
export function preferenceEffects(current, next, bubble) {
  const changed = key => next[key] !== current[key];
  const layout = ['mode', 'orbSize', 'petSize', 'orbOpacity', 'petOpacity', 'snapToEdge', 'alwaysOnTop', 'dockEdge'].some(changed);
  const menu = ['mode', 'bubbleEnabled', 'quotaEnabled'].some(changed);
  const hideBubble = !!bubble && (changed('mode') ||
    (bubble.kind === 'quote' && !next.bubbleEnabled) || (bubble.kind === 'quota' && !next.quotaEnabled));
  const refreshBubble = !!bubble && !hideBubble && (changed('bubbleEnabled') || changed('quotaEnabled'));
  const rescheduleBubble = changed('bubbleSeconds') && !!bubble && !bubble.loading && !hideBubble;
  return { layout, menu, hideBubble, refreshBubble, rescheduleBubble };
}
