import { describe, expect, it } from 'vitest';
import {
  InventoryPages,
  SLOT_PAGES,
  pageFirstSlot,
  pageOfSlot,
  setUnlockedPages,
  usableRows,
} from './inventoryPages';
import { InventoryConstants } from './inventoryConstants';

describe('the inventory pages (D33)', () => {
  it('starts page II at the first extension slot and page III 64 slots later', () => {
    expect(pageFirstSlot(1)).toBe(InventoryConstants.LastEquippableItemSlotIndex + 1);
    expect(pageFirstSlot(2)).toBe(InventoryConstants.FirstExtensionItemSlotIndex);
    expect(pageFirstSlot(3)).toBe(InventoryConstants.FirstExtensionItemSlotIndex + 64);
    expect(pageFirstSlot(SLOT_PAGES + 1)).toBe(InventoryConstants.FirstStoreItemSlotIndex);
  });

  it('knows the page of a slot', () => {
    expect(pageOfSlot(12)).toBe(1);
    expect(pageOfSlot(75)).toBe(1);
    expect(pageOfSlot(76)).toBe(2);
    expect(pageOfSlot(203)).toBe(3);
  });

  it('holds three pages in the inventory slots', () => {
    expect(SLOT_PAGES).toBe(3);
  });

  it('takes the unlocked pages from the server, within what the slots hold', () => {
    setUnlockedPages(2);
    expect(InventoryPages.unlocked).toBe(2);
    expect(usableRows()).toBe(16);
    setUnlockedPages(7);
    expect(InventoryPages.unlocked).toBe(SLOT_PAGES);
    setUnlockedPages(0);
    expect(InventoryPages.unlocked).toBe(1);
  });
});
