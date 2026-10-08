import { memo, useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import type { Item } from '../../../ecs/world';
import { itemIconKey, itemIconPackChain } from '../../../common/itemIconPack';
import { ITEM_ICON_FIT } from '../../../common/itemIconFit';
import { itemLevelLook } from '../../../common/itemLevelLook';
import { smoothedIcon, smoothIcon } from '../../../common/itemIconSmooth';

/**
 * `<img fetchpriority>` is not a React 18 prop (it arrives with React 19), so
 * it goes to the DOM as a plain lowercase attribute. High: an icon is what the
 * player is waiting on; the world's model / texture fetches are already high
 * and would otherwise starve it (see itemIconPack.ts).
 */
const IMG_PRIORITY = { fetchpriority: 'high' } as const;

/**
 * The pack renders every item at one world scale into a canvas sized by its
 * inventory footprint, so a small item covers a small part of its own PNG and
 * fitting that canvas to the square left a jewel a few pixels across. The
 * measured zoom (tools/itemIconFit.ts) blows the opaque box back up to the
 * square; the translate takes off the render's drift off centre first, since
 * the zoom is about the canvas centre and would scale that drift too.
 *
 * The zoom never overflows: it is capped by the canvas, and the canvas is
 * what `max-width/height: 100%` has already fitted into the box.
 */
function fitTransform(item: Item): string | undefined {
  const key = `${item.group}_${item.num}`;
  const levelKey = itemLevelLook(item.group, item.num, item.lvl) ? `${key}_${item.lvl}` : key;
  const fit = ITEM_ICON_FIT[levelKey];
  if (!fit) return undefined;
  const [zoom, dx, dy] = fit;
  return `scale(${zoom * (ICON_SIZE_OVERRIDE[key] ?? 1)}) translate(${dx * 100}%, ${dy * 100}%)`;
}

/**
 * MUIdle: items drawn larger than the original draws them. The Jewel of Chaos is a thin crystal the
 * original draws at `o->Scale` 0.002 against the other jewels' 0.0035 (itemIconScale.ts), which left
 * it a speck beside them; the owner asked for it at the jewels' size. Measured on the pack's
 * pictures, its opaque box is 15% of its picture's height against Bless' 20% (which the fit's zoom
 * of 3.97 draws at 79% of the square), so it takes a zoom of 5.3 - 2.35 times its fit - to stand as
 * tall as the other jewels.
 */
const ICON_SIZE_OVERRIDE: Readonly<Record<string, number>> = {
  '12_15': 2.35,
};

/**
 * An item's icon from the pre-rendered pack (itemIconPack.ts).
 *
 * An observer leaf taking the item itself: only the fields the file name
 * depends on (`itemIconKey`) are read here, so a durability tick or an
 * option change on one item re-renders nothing - the grid above passes the
 * same `item` reference and this memo skips. (The old `{...item}` spread
 * subscribed the whole grid to all fourteen fields of every item.)
 */
export const ItemIcon = memo(
  observer(function ItemIcon({ item }: { item: Item }) {
    const key = itemIconKey(item);
    /** Which URL of the pack chain is showing; past the end = no file at all. */
    const [fallbackStep, setFallbackStep] = useState(0);
    useEffect(() => {
      setFallbackStep(0);
    }, [key]);
    const chain = itemIconPackChain(item);
    const src = chain[fallbackStep] as string | undefined;
    // The smoothed picture once it is made (itemIconSmooth.ts); the pack's own until then.
    const smoothed = src ? smoothedIcon(src) : null;
    const [, setSmoothedReady] = useState(0);
    useEffect(() => {
      if (!src || smoothed !== undefined) return;
      let live = true;
      void smoothIcon(src).then(() => live && setSmoothedReady(n => n + 1));
      return () => {
        live = false;
      };
    }, [src, smoothed]);

    if (!src) {
      return (
        <div
          className="item-icon item-icon-missing"
          title={`item ${item.group}/${item.num}`}
        />
      );
    }

    return (
      <img
        src={smoothed || src}
        className="item-icon"
        style={{ transform: fitTransform(item) }}
        alt=""
        draggable={false}
        decoding="async"
        {...IMG_PRIORITY}
        onError={() => setFallbackStep(step => step + 1)}
      />
    );
  })
);
