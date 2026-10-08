import type { Item } from '../ecs/world';

/**
 * The items the server stacks (D28, the MUIdle stack sizes: potions and jewels up to 255 pieces), where
 * an item's durability is its number of pieces. Group 14 keeps the original's rule - any count over one
 * is shown - and the Jewel of Chaos (group 12) joins it.
 */
const PIECES_GROUP = 14;
const PIECES_ELSEWHERE = new Set(['12_15']);

export function countsPieces(item: { group: number; num: number }): boolean {
  return item.group === PIECES_GROUP || PIECES_ELSEWHERE.has(`${item.group}_${item.num}`);
}

/** The pieces of a stack (0 when the item is not one). */
export function stackCount(item: Item): number {
  return countsPieces(item) ? (item.durability ?? 0) : 0;
}

/**
 * Whether dropping `picked` on `target` asks the server to merge them (`MoveItemAction`'s full or partial
 * stack): the same item at the same level. The server decides; a refusal puts the item back.
 */
export function mergesWith(picked: Item, target: Item): boolean {
  return (
    countsPieces(picked) &&
    picked.group === target.group &&
    picked.num === target.num &&
    (picked.lvl ?? 0) === (target.lvl ?? 0)
  );
}
