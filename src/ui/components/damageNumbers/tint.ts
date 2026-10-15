import { useEffect, useState } from 'react';

export type Rgb = readonly [number, number, number];

/** Strength of the outline grown one pixel around the atlas's own (0-1). */
const OUTLINE_ALPHA = 0.85;

/**
 * The atlas as the original draws it (a white texture times `glColor4f`): the
 * glyph takes the colour, the black outline baked into the texture stays
 * black. A mask in the colour cut the glyph out with its outline, so the
 * numbers lost their border (10-15, hard to read on the ground); one more
 * pixel of outline is grown around the glyph for the same reason.
 */
export function tintGlyphs(
  source: Uint8ClampedArray,
  width: number,
  height: number,
  colour: Rgb
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(source.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const alpha = source[i + 3] / 255;

      let around = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          around = Math.max(around, source[(ny * width + nx) * 4 + 3] / 255);
        }
      }
      const outline = around * OUTLINE_ALPHA;

      // The tinted glyph over a black outline.
      const total = alpha + outline * (1 - alpha);
      if (total <= 0) continue;
      const keep = alpha / total;
      out[i] = source[i] * colour[0] * keep;
      out[i + 1] = source[i + 1] * colour[1] * keep;
      out[i + 2] = source[i + 2] * colour[2] * keep;
      out[i + 3] = total * 255;
    }
  }
  return out;
}

/** The font atlas, decoded, once its sprite is there. */
export function useAtlasImage(url: string | undefined): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setImage(img);
    };
    img.src = url;
    return () => {
      cancelled = true;
    };
  }, [url]);

  return image;
}

const classes = new Map<string, string>();
let sheet: CSSStyleSheet | null = null;

/**
 * A class whose `.digit`s draw the atlas in `colour`. Each colour is tinted
 * once and lives in one style rule, so a digit is a plain background - no mask
 * and no per-number image in its inline style.
 */
export function tintClass(atlas: HTMLImageElement, colour: Rgb): string {
  const key = `${atlas.src}|${colour.join(',')}`;
  const known = classes.get(key);
  if (known) return known;

  const { naturalWidth: width, naturalHeight: height } = atlas;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return '';
  context.drawImage(atlas, 0, 0);
  const pixels = context.getImageData(0, 0, width, height);
  pixels.data.set(tintGlyphs(pixels.data, width, height, colour));
  context.putImageData(pixels, 0, 0);

  if (!sheet) {
    const style = document.createElement('style');
    document.head.appendChild(style);
    sheet = style.sheet;
  }

  const name = `damage-tint-${classes.size}`;
  sheet?.insertRule(
    `.damage-number .${name} .digit { background-image: url("${canvas.toDataURL()}"); }`
  );
  classes.set(key, name);
  return name;
}
