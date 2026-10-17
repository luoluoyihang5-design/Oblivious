import test from 'node:test';
import assert from 'node:assert/strict';
import { removeExteriorWhite } from '../src/logo-matte.mjs';
test('outside white is transparent while enclosed white and black remain opaque', () => {
  const width = 9, height = 9, data = new Uint8ClampedArray(width * height * 4).fill(255);
  const paint = (x, y, value) => { const offset = (y * width + x) * 4; data[offset] = data[offset + 1] = data[offset + 2] = value; };
  for (let i = 2; i <= 6; i++) { paint(i, 2, 0); paint(i, 6, 0); paint(2, i, 0); paint(6, i, 0); }
  const output = removeExteriorWhite({ data, width, height });
  assert.equal(output[3], 0);
  assert.deepEqual([...output.slice((4 * width + 4) * 4, (4 * width + 4) * 4 + 4)], [255, 255, 255, 255]);
  assert.equal(output[(2 * width + 4) * 4 + 3], 255);
  assert.equal(data[3], 255, 'source logo is unchanged');
});
test('a white opening connected to the border is not an internal white fill', () => {
  const data = new Uint8ClampedArray(3 * 3 * 4).fill(255);
  const output = removeExteriorWhite({ data, width: 3, height: 3 });
  assert.ok([...output].filter((_, index) => index % 4 === 3).every(alpha => alpha === 0));
});
