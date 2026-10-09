import type { TextKey } from '../../../../../i18n';
import { InventoryConstants } from '../../../../../common/inventoryConstants';
import { PAGE_COLUMNS, PAGE_ROWS } from '../../../../../common/inventoryPages';

/**
 * MUIdle (D33): the window keeps the original's frame (190 x 429, beside the vault and the shops) and
 * lays it out like the owner's reference - the worn gear as three rows of cards and a row of jewelry,
 * the page tabs, the selling buttons, one 8 x 8 page of the bag, the Zen and "repair all".
 */
export const GRID_X = 15;
export const GRID_Y = 232;

export const SQUARE = 20;

export const COLUMNS = PAGE_COLUMNS;
export const ROWS = PAGE_ROWS;
export const SQUARES = COLUMNS * ROWS;

export const SQUARE_SPRITE = 'newui_item_box.OZT';

const WND_TOP_EDGE = 3;
const WND_LEFT_EDGE = 4;
const WND_BOTTOM_EDGE = 8;
const WND_RIGHT_EDGE = 9;
const TABLE_CORNER = 14;

export const GRID_FRAME_X = GRID_X - WND_LEFT_EDGE;
export const GRID_FRAME_Y = GRID_Y - WND_TOP_EDGE;
export const GRID_FRAME_WIDTH =
  COLUMNS * SQUARE - WND_RIGHT_EDGE + WND_LEFT_EDGE + TABLE_CORNER;
export const GRID_FRAME_HEIGHT =
  ROWS * SQUARE - WND_BOTTOM_EDGE + WND_TOP_EDGE + TABLE_CORNER;

export const TITLE_Y = 12;
export const TITLE: TextKey = 'inventory.title';

/** The page tabs (I to VII) and, right of them, the squares in use. */
export const TABS_X = 15;
export const TABS_Y = 196;
export const TAB_WIDTH = 17;
export const TAB_GAP = 2;
export const TAB_HEIGHT = 13;

/** "Batch sell" and "Sell junk" - or the bar that confirms one of them. */
export const ACTIONS_Y = 212;
export const ACTIONS_HEIGHT = 15;

/** The Zen, the personal shop and "Repair all", under the grid. */
export const FOOTER_Y = 402;
export const FOOTER_HEIGHT = 16;
export const MONEY_X = 15;
export const MONEY_WIDTH = 76;
export const SHOP_BUTTON_X = 94;
export const SHOP_BUTTON_SIZE = 16;
export const REPAIR_ALL_X = 113;
export const REPAIR_ALL_WIDTH = 62;

export const SHOP_SPRITE = 'newui_Bt_openshop.OZT';
export const SHOP_TOOLTIP: TextKey = 'inventory.personalShop';

export type EquipmentSlotInfo = {
  slot: number;
  x: number;
  y: number;
  width: number;
  height: number;
  sprite: string;
};

const CARD = 50;
const COLUMN_X = [GRID_X, GRID_X + CARD + 5, GRID_X + 2 * (CARD + 5)];
const SMALL = 22;

/** Three rows of cards - pet, helm, wings / weapons and armor / gloves, pants, boots - then the jewelry. */
export const EQUIPMENT_SLOTS: EquipmentSlotInfo[] = [
  { slot: InventoryConstants.PetSlot, x: COLUMN_X[0], y: 32, width: CARD, height: 38, sprite: 'newui_item_fairy.OZT' },
  { slot: InventoryConstants.HelmSlot, x: COLUMN_X[1], y: 32, width: CARD, height: 38, sprite: 'newui_item_cap.OZT' },
  { slot: InventoryConstants.WingsSlot, x: COLUMN_X[2], y: 32, width: CARD, height: 38, sprite: 'newui_item_wing.OZT' },
  { slot: InventoryConstants.LeftHandSlot, x: COLUMN_X[0], y: 73, width: CARD, height: 52, sprite: 'newui_item_weapon(L).OZT' },
  { slot: InventoryConstants.ArmorSlot, x: COLUMN_X[1], y: 73, width: CARD, height: 52, sprite: 'newui_item_upper.OZT' },
  { slot: InventoryConstants.RightHandSlot, x: COLUMN_X[2], y: 73, width: CARD, height: 52, sprite: 'newui_item_weapon(R).OZT' },
  { slot: InventoryConstants.GlovesSlot, x: COLUMN_X[0], y: 128, width: CARD, height: 38, sprite: 'newui_item_gloves.OZT' },
  { slot: InventoryConstants.PantsSlot, x: COLUMN_X[1], y: 128, width: CARD, height: 38, sprite: 'newui_item_lower.OZT' },
  { slot: InventoryConstants.BootsSlot, x: COLUMN_X[2], y: 128, width: CARD, height: 38, sprite: 'newui_item_boots.OZT' },
  { slot: InventoryConstants.PendantSlot, x: GRID_X, y: 169, width: SMALL, height: SMALL, sprite: 'newui_item_necklace.OZT' },
  { slot: InventoryConstants.Ring1Slot, x: GRID_X + SMALL + 3, y: 169, width: SMALL, height: SMALL, sprite: 'newui_item_ring.OZT' },
  { slot: InventoryConstants.Ring2Slot, x: GRID_X + 2 * (SMALL + 3), y: 169, width: SMALL, height: SMALL, sprite: 'newui_item_ring.OZT' },
];

export const HEAD_CLOSE_X = 169;
export const HEAD_CLOSE_Y = 7;
export const HEAD_CLOSE_WIDTH = 13;
export const HEAD_CLOSE_HEIGHT = 12;

export const INVENTORY_SPRITES = [SQUARE_SPRITE, SHOP_SPRITE, ...EQUIPMENT_SLOTS.map(slot => slot.sprite)];
