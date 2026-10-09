import { observable, runInAction } from 'mobx';
import { InventoryConstants } from './inventoryConstants';

/**
 * The inventory window's pages (D33). Page I is the classic 8 x 8 grid; every further page is two
 * inventory extensions of four rows. Their slots follow each other (OpenMU numbers the extension rows
 * right after the grid), so page p starts 64 slots after page p - 1, and an item never lies across
 * two pages.
 */
export const PAGE_COLUMNS = InventoryConstants.RowSize;
export const PAGE_ROWS = InventoryConstants.InventoryRows;
export const PAGE_SQUARES = PAGE_COLUMNS * PAGE_ROWS;
export const FIRST_GRID_SLOT = InventoryConstants.LastEquippableItemSlotIndex + 1;

/** The pages the inventory's own slots hold: the grid and four extensions. */
export const SLOT_PAGES =
  1 + (InventoryConstants.MaximumNumberOfExtensions * InventoryConstants.RowsOfOneExtension) / PAGE_ROWS;

/** The first slot of a page (1-based). */
export function pageFirstSlot(page: number): number {
  return FIRST_GRID_SLOT + (page - 1) * PAGE_SQUARES;
}

/** The page (1-based) a grid slot lies on. */
export function pageOfSlot(slot: number): number {
  return Math.floor((slot - FIRST_GRID_SLOT) / PAGE_SQUARES) + 1;
}

/** The pages the character has, as the server last said (one until it did). */
export const InventoryPages = observable({ unlocked: 1 });

export function setUnlockedPages(pages: number): void {
  runInAction(() => {
    InventoryPages.unlocked = Math.max(1, Math.min(SLOT_PAGES, Math.floor(pages) || 1));
  });
}

/** The grid rows the character can use: eight per page it has. */
export function usableRows(): number {
  return InventoryPages.unlocked * PAGE_ROWS;
}
