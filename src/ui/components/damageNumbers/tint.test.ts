import { describe, expect, it } from 'vitest';
import { tintGlyphs } from './tint';

/** One row: a transparent pixel, the atlas's black outline, a white glyph pixel, transparent. */
const row = new Uint8ClampedArray([
  0, 0, 0, 0,
  0, 0, 0, 255,
  255, 255, 255, 255,
  0, 0, 0, 0,
]);

describe('damage number tint', () => {
  const out = tintGlyphs(row, 4, 1, [1, 0.6, 0]);
  const pixel = (x: number) => [...out.slice(x * 4, x * 4 + 4)];

  it('colours the glyph like the texture times the colour', () => {
    expect(pixel(2)).toEqual([255, 153, 0, 255]);
  });

  it('keeps the black outline black', () => {
    expect(pixel(1)).toEqual([0, 0, 0, 255]);
  });

  it('grows a dark pixel of outline around the glyph', () => {
    const [r, g, b, a] = pixel(3);
    expect([r, g, b]).toEqual([0, 0, 0]);
    expect(a).toBeGreaterThan(200);
  });

  it('leaves the rest transparent', () => {
    expect(pixel(0)[3]).toBeGreaterThan(0); // next to the outline
    expect([...tintGlyphs(new Uint8ClampedArray(4), 1, 1, [1, 1, 1])]).toEqual([0, 0, 0, 0]);
  });
});
