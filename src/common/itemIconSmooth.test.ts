import { describe, expect, it } from 'vitest';
import { sharpenAlpha } from './itemIconSmooth';

describe('sharpenAlpha (the smoothed icon outline)', () => {
  const alphaOf = (alpha: number) => {
    const rgba = new Uint8ClampedArray([200, 100, 50, alpha]);
    sharpenAlpha(rgba);
    return rgba;
  };

  it('clears the faint fringe of the upscale and fills the inside', () => {
    expect(alphaOf(40)[3]).toBe(0);
    expect(alphaOf(76)[3]).toBe(0);
    expect(alphaOf(180)[3]).toBe(255);
    expect(alphaOf(255)[3]).toBe(255);
  });

  it('keeps a ramp across the edge itself, and the colour as it is', () => {
    const middle = alphaOf(128);
    expect(middle[3]).toBeGreaterThan(110);
    expect(middle[3]).toBeLessThan(145);
    expect(alphaOf(100)[3]).toBeLessThan(alphaOf(150)[3]);
    expect([...middle.slice(0, 3)]).toEqual([200, 100, 50]);
  });
});
