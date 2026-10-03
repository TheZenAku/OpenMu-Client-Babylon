/**
 * The odds of a Chaos Machine mix as the server reports them (`MUIdleMixPreview`): the crafting's
 * own item check, its success rate and its price with the Chaos Machine tax - the numbers the mix
 * itself uses. Nothing here computes a chance; this module only reads the answer. No store imports,
 * so it is testable on its own.
 */

export type MixPreview = {
  /** The crafting the preview is for (the one the player picked). */
  mixType: number;
  /** The crafting's refusal (a server `CraftingResult` name), or null when the items fit. */
  result: string | null;
  /** Success rate in percent. */
  rate: number;
  /** Zen the mix takes, tax included. */
  cost: number;
  /** Another crafting the items fit when the picked one refuses them. */
  fits: number | null;
};

export type MixOddsView =
  | { kind: 'odds'; rate: number; cost: number }
  | { kind: 'fits'; mixType: number }
  | { kind: 'refused'; result: string }
  | null;

/** The server's answer, or null when it is not one. */
export function parseMixPreview(data: unknown): MixPreview | null {
  if (typeof data !== 'object' || data === null) return null;
  const d = data as Record<string, unknown>;
  if (typeof d.mixType !== 'number' || typeof d.rate !== 'number' || typeof d.cost !== 'number') return null;
  return {
    mixType: d.mixType,
    result: typeof d.result === 'string' ? d.result : null,
    rate: d.rate,
    cost: d.cost,
    fits: typeof d.fits === 'number' ? d.fits : null,
  };
}

/**
 * What the window shows for the picked recipe. An answer about another recipe is stale (the player
 * picked again meanwhile) and shows nothing; a suggestion only names a recipe the menu lists.
 */
export function mixOddsView(
  preview: MixPreview | null,
  picked: number,
  listed: readonly number[]
): MixOddsView {
  if (!preview || preview.mixType !== picked) return null;
  if (preview.result === null) return { kind: 'odds', rate: preview.rate, cost: preview.cost };
  if (preview.fits !== null && listed.includes(preview.fits)) return { kind: 'fits', mixType: preview.fits };
  return { kind: 'refused', result: preview.result };
}

type TrayItem = { group: number; num: number; lvl?: number; durability?: number; raw?: number[] } | null;

/** Changes whenever the tray does - a stack growing included - to ask for new odds. */
export function traySignature(items: readonly TrayItem[]): string {
  return items
    .map(item => (item ? (item.raw ?? [item.group, item.num, item.lvl ?? 0, item.durability ?? 0]).join('.') : ''))
    .join(',');
}
