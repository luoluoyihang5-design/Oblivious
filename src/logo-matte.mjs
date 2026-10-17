// Remove only white connected to the image border. Enclosed white areas in
// the knot remain opaque, so the icon's internal gaps are usable hit targets.
export function removeExteriorWhite({ data, width, height }) {
  const count = width * height;
  if (!Number.isSafeInteger(count) || width < 1 || height < 1 || data.length !== count * 4) throw new Error('Invalid logo pixels');
  const output = new Uint8ClampedArray(data), outside = new Uint8Array(count), queue = new Uint32Array(count);
  let head = 0, tail = 0;
  function visit(index) {
    if (outside[index]) return;
    const offset = index * 4;
    if (data[offset + 3] > 12 && Math.min(data[offset], data[offset + 1], data[offset + 2]) < 245) return;
    outside[index] = 1; queue[tail++] = index;
  }
  for (let x = 0; x < width; x++) { visit(x); visit((height - 1) * width + x); }
  for (let y = 0; y < height; y++) { visit(y * width); visit(y * width + width - 1); }
  while (head < tail) {
    const index = queue[head++], x = index % width;
    if (x) visit(index - 1);
    if (x < width - 1) visit(index + 1);
    if (index >= width) visit(index - width);
    if (index < count - width) visit(index + width);
  }
  for (let index = 0; index < count; index++) {
    const offset = index * 4;
    if (outside[index]) { output[offset + 3] = 0; continue; }
    const x = index % width;
    const border = (x && outside[index - 1]) || (x < width - 1 && outside[index + 1]) || (index >= width && outside[index - width]) || (index < count - width && outside[index + width]);
    if (border) {
      const white = Math.min(data[offset], data[offset + 1], data[offset + 2]);
      if (white > 0) {
        output[offset] = output[offset + 1] = output[offset + 2] = 0;
        output[offset + 3] = Math.round(data[offset + 3] * (1 - white / 255));
      }
    }
  }
  return output;
}
