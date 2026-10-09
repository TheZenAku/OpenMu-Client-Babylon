import { describe, expect, it, vi } from 'vitest';

// The state only needs the store for toasts and the helper; the real one pulls in the whole game.
vi.mock('../store', () => ({
  Store: { addNotification: () => {}, muHelper: { active: false }, playerData: {} },
}));
import { MUIdle } from './state';
import { InventoryPages } from '../common/inventoryPages';
import { ItemSerializer } from '../common/itemSerializer';

const SUB_STATE = 0x01;

function hexOf(bytes: Uint8Array, length: number): string {
  return Array.from(bytes.slice(0, length), b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

describe('the storage pages in the idle state (D33)', () => {
  it('reads the stored items and keeps the slot pages apart from them', () => {
    const buffer = new Uint8Array(32);
    const length = ItemSerializer.SerializeItem(buffer, { group: 0, num: 3, lvl: 7, durability: 30 });

    MUIdle.onPacket(
      SUB_STATE,
      JSON.stringify({
        hunt: false,
        inventory: {
          unlocked: 5,
          native: 3,
          available: 7,
          prices: [0, 0, 1000, 3000, 6000, 12000, 25000],
          storage: [
            { slot: 64, data: hexOf(buffer, length), locked: true },
            { slot: 70, data: 'not hex' },
          ],
        },
      })
    );

    expect(MUIdle.inventoryPages.unlocked).toBe(5);
    expect(InventoryPages.unlocked).toBe(3);
    expect(MUIdle.storedItems).toHaveLength(1);
    expect(MUIdle.storedItems[0]).toMatchObject({ slot: 64, locked: true, item: { group: 0, num: 3, lvl: 7 } });
  });
});
