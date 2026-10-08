/**
 * Smooth edges for the pre-rendered item icons (itemIconPack.ts).
 *
 * The pack was rendered without anti-aliasing and small: every pixel is either fully opaque or fully
 * clear, and a jewel is 21 x 25 of them. The inventory draws them at about one screen pixel each, so
 * every outline is a staircase - the owner saw the items "serrilhados". The fix is made once per
 * picture, in the browser: a bicubic upscale (`imageSmoothingQuality: 'high'`) turns the steps into
 * slopes, and a smoothstep on the alpha draws the outline back to a crisp edge one sub-pixel wide.
 * The browser's own downscale to the square then anti-aliases it. Twice the size was as good as
 * three times on the pack (compared at the inventory's scale), at under half the memory.
 *
 * The files stay as they are: 8 128 pictures in git, and the original's look is kept.
 */

/** The upscale. */
const SCALE = 2;
/** Wider than any pack picture (280): rendered smooth already (the Jewel of Life, D29). */
const SMOOTH_ALREADY = 300;
/** The alpha the outline is drawn at: under LO clear, over HI opaque, a smoothstep between. */
const LO = 0.3;
const HI = 0.7;

/** `src` → its smoothed picture (a data URL), null when it is kept as it is, or the work under way. */
const done = new Map<string, string | null>();
const pending = new Map<string, Promise<string | null>>();
/** One picture at a time: the inventory asks for sixty at once, and each takes a few milliseconds. */
let queue: Promise<unknown> = Promise.resolve();

/** The outline: clears the bicubic fringe and makes the rest of it a one-sub-pixel ramp. */
export function sharpenAlpha(rgba: Uint8ClampedArray): void {
  for (let i = 3; i < rgba.length; i += 4) {
    const t = Math.min(1, Math.max(0, (rgba[i] / 255 - LO) / (HI - LO)));
    rgba[i] = Math.round(t * t * (3 - 2 * t) * 255);
  }
}

/** The smoothed picture when it is ready (null: use `src`), undefined while it is not. */
export function smoothedIcon(src: string): string | null | undefined {
  return done.get(src);
}

/** Smooths `src` once; resolves to its data URL, or null to keep `src` (too large, or no canvas). */
export function smoothIcon(src: string): Promise<string | null> {
  if (done.has(src)) return Promise.resolve(done.get(src)!);
  let work = pending.get(src);
  if (!work) {
    // A picture that fails (a 404 the fallback chain moves past) is kept as it is.
    work = queue.then(() => smooth(src)).catch(() => null);
    queue = work;
    pending.set(src, work);
    void work.then(url => {
      done.set(src, url);
      pending.delete(src);
    });
  }
  return work;
}

async function smooth(src: string): Promise<string | null> {
  const img = new Image();
  img.src = src;
  await img.decode();
  const { naturalWidth: w, naturalHeight: h } = img;
  if (!w || !h || w > SMOOTH_ALREADY) return null;

  const canvas = document.createElement('canvas');
  canvas.width = w * SCALE;
  canvas.height = h * SCALE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  sharpenAlpha(pixels.data);
  ctx.putImageData(pixels, 0, 0);

  // Not `toBlob`: Chrome encodes that in idle time, which a game drawing every frame hardly has (0.9 s
  // a picture, measured in the world); this is 2 ms, about 8 KB.
  return canvas.toDataURL('image/png');
}
