export function initialBubbleSize(data) {
  return data?.kind === 'quote' ? { width: 280, height: 130 } : { width: 328, height: data?.loading || !data?.ok ? 146 : 292 };
}
export function fitBubbleSize(size, area) {
  const maxWidth = Math.max(1, Math.min(360, area.width - 16));
  const maxHeight = Math.max(1, Math.min(480, area.height - 16));
  return {
    width: Math.min(maxWidth, Math.max(Math.min(240, maxWidth), Math.ceil(size.width))),
    height: Math.min(maxHeight, Math.max(Math.min(112, maxHeight), Math.ceil(size.height))),
  };
}
