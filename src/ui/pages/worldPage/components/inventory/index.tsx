import { isKey, actionOfKey } from '../../../../../common/keyBindings';
import { t } from '../../../../../i18n';
import './style.less';
import { observer } from 'mobx-react-lite';
import { Store } from '../../../../../store';
import { Economy } from '../../../../../economy';
import { events } from '../../../../../events';
import { ItemIcon } from '../../../../components/itemIcon';
import { ItemTooltip } from '../../../../components/itemTooltip';
import { useEventBus } from '../../../../../hooks/useEventBus';
import { Item } from '../../../../../ecs/world';
import {
  GridSquares,
  occupancyStamp,
  usedMask,
} from '../../../../components/itemGrid';
import { ItemsDatabase } from '../../../../../common/itemsDatabase';
import {
  ITEM_HOTKEY_CODES,
  canRegisterItemHotkey,
} from '../../../../../common/itemHotkeys';
import { isUpgradeJewel } from '../../../../../common/jewelUpgrade';
import { mergesWith, stackCount } from '../../../../../common/itemStacks';
import { SplitStackDialog, type SplitRequest } from './splitStack';
import {
  equipDestination,
  isEquipable,
} from '../../../../../common/equipSlots';
import { InventorySort } from '../../../../../common/inventorySort';
import { QuickItemActions } from '../../../../../common/quickItemActions';
import { StorageKind } from '../../../../../common/itemStorage';
import { InventoryConstants } from '../../../../../common/inventoryConstants';
import { InventoryPages, SLOT_PAGES, pageFirstSlot } from '../../../../../common/inventoryPages';
import { itemValue } from '../../../../../common/itemValue';
import { durabilityPercent } from '../../../../../common/stateWarnings';
import { MUIdle, pageName, zenText } from '../../../../../muidle/state';
import { mt } from '../../../../../muidle/text';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MuSpriteFrame } from '../../../../components/muSprite';
import { MuItemWindow, MuTableFrame } from '../../../../components/muWindow';
import { playUiSound } from '../../../../../libs/sfx';
import {
  ACTIONS_HEIGHT,
  ACTIONS_Y,
  COLUMNS,
  EQUIPMENT_SLOTS,
  FOOTER_HEIGHT,
  FOOTER_Y,
  GRID_FRAME_HEIGHT,
  GRID_FRAME_WIDTH,
  GRID_FRAME_X,
  GRID_FRAME_Y,
  HEAD_CLOSE_HEIGHT,
  HEAD_CLOSE_WIDTH,
  HEAD_CLOSE_X,
  HEAD_CLOSE_Y,
  GRID_X,
  GRID_Y,
  MONEY_WIDTH,
  MONEY_X,
  REPAIR_ALL_WIDTH,
  REPAIR_ALL_X,
  ROWS,
  SHOP_BUTTON_SIZE,
  SHOP_BUTTON_X,
  SHOP_TOOLTIP,
  SQUARE,
  SQUARES,
  TAB_GAP,
  TAB_HEIGHT,
  TAB_WIDTH,
  TABS_X,
  TABS_Y,
  TITLE,
  TITLE_Y,
} from './layout';

const WINDOW_ID = 'inventory';

function itemSize(item: Item): { w: number; h: number } {
  const config = ItemsDatabase.getItem(item.group, item.num);
  return { w: config?.X ?? 1, h: config?.Y ?? 1 };
}

type Placed = {
  slot: number;
  item: Item;
  column: number;
  row: number;
  w: number;
  h: number;
};

/** The squares of one page (D33) and the items lying on it; `first` is the page's first slot. */
function buildOccupancy(items: (Item | null)[], first: number) {
  const squares: (Placed | null)[] = new Array(SQUARES).fill(null);
  const placed: Placed[] = [];

  for (let square = 0; square < SQUARES; square++) {
    const slot = first + square;
    const item = items[slot];
    if (!item) continue;

    const column = square % COLUMNS;
    const row = (square - column) / COLUMNS;
    const { w, h } = itemSize(item);

    const entry: Placed = { slot, item, column, row, w, h };
    placed.push(entry);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (column + x >= COLUMNS || row + y >= ROWS) continue;
        squares[square + y * COLUMNS + x] = entry;
      }
    }
  }

  return { squares, placed };
}

function canPlace(
  squares: (Placed | null)[],
  column: number,
  row: number,
  w: number,
  h: number
): boolean {
  if (column < 0 || row < 0) return false;
  if (column + w > COLUMNS || row + h > ROWS) return false;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (squares[(row + y) * COLUMNS + column + x]) return false;
    }
  }

  return true;
}

function targetSquareAt(
  offsetX: number,
  offsetY: number,
  w: number,
  h: number
): { column: number; row: number } {
  const x = offsetX - ((w - 1) * SQUARE) / 2;
  const y = offsetY - ((h - 1) * SQUARE) / 2;

  return { column: Math.floor(x / SQUARE), row: Math.floor(y / SQUARE) };
}

/** The first place (row by row, from the top left) a w x h item fits at; null on a full page. */
function firstFit(
  squares: (Placed | null)[],
  w: number,
  h: number
): { column: number; row: number } | null {
  for (let row = 0; row + h <= ROWS; row++) {
    for (let column = 0; column + w <= COLUMNS; column++) {
      if (canPlace(squares, column, row, w, h)) return { column, row };
    }
  }
  return null;
}

/**
 * MUIdle: where the press that lifted the carried item was. Letting go farther than DRAG_DISTANCE
 * from it is a drag, and drops the item under the pointer - the original lifts and drops on two
 * clicks only, and a drag left the item on the cursor until a right click put it back in the hand
 * (the owner took that for a weapon that would not come off).
 */
let liftedAt: { x: number; y: number } | null = null;
const DRAG_DISTANCE = 8;

/** The carried item let go over an equipment slot: the slot's click, or the end of a drag. */
function dropOnEquipment(slot: number, item: Item | null): void {
  const picked = Store.pickedItem;
  if (!picked) return;

  // A jewel dropped on worn gear: ApplyJewels explains why not
  // (OpenMU only upgrades items lying in the grid).
  if (item && isUpgradeJewel(picked.item)) {
    Store.applyPickedJewel(slot);
    return;
  }

  if (item) return;
  if (!isEquipable(slot, picked.item)) return;

  Store.placePickedItem(slot);
}

const POTION_GROUP = 14;

function isConsumable(item: Item): boolean {
  if (item.group !== POTION_GROUP) return false;

  const n = item.num;
  return (n >= 0 && n <= 10) || (n >= 35 && n <= 40);
}

/** The bar under a worn item: green, then gold below half, red below a fifth. */
function durabilityClass(percent: number): string {
  if (percent < 20) return 'low';
  if (percent < 50) return 'mid';
  return 'high';
}

/** Excellent gear is framed green, ancient gold - as the reference draws them. */
function qualityClass(item: Item): string {
  if (item.isAncient) return ' ancient';
  if (item.isExcellent) return ' excellent';
  return '';
}

const EquipmentSlot = observer(
  ({
    slot,
    x,
    y,
    width,
    height,
    sprite,
    item,
    onHover,
    onPutAway,
  }: {
    slot: number;
    x: number;
    y: number;
    width: number;
    height: number;
    sprite: string;
    item: Item | null;
    onHover: (info: HoverInfo | null) => void;
    /** MUIdle: the worn item (or the one carried off a slot) into the first free place of the bag. */
    onPutAway: () => void;
  }) => {
    const picked = Store.pickedItem;

    const fits = !!picked && isEquipable(slot, picked.item) && !item;
    const blocked = !!picked && !fits;
    const durability = item ? durabilityPercent(item) : null;

    return (
      <div
        className={`equipment-slot${fits ? ' can-equip' : ''}${
          blocked ? ' blocked' : ''
        }${item ? ` filled${qualityClass(item)}` : ''}`}
        data-no-drag="true"
        data-equipment-slot={slot}
        style={{ left: x, top: y, width, height }}
        onPointerEnter={event =>
          onHover(item ? { item, slot, x: event.clientX, y: event.clientY } : null)
        }
        onPointerLeave={() => onHover(null)}
        onPointerDown={event => {
          if (event.button !== 0) return;
          event.stopPropagation();

          if (!picked) {
            // REPAIR_MODE_ON (NewUIMyInventory.cpp:1415): the click repairs.
            if (Store.repairMode) {
              if (item) Store.repairItemRequest(slot);
              return;
            }
            if (item) {
              Store.pickInventoryItem(slot);
              liftedAt = { x: event.clientX, y: event.clientY };
            }
            return;
          }

          dropOnEquipment(slot, item);
        }}
        onContextMenu={event => {
          // MUIdle: a right click takes the worn item off into the bag, as one in the bag puts it on.
          event.preventDefault();
          event.stopPropagation();
          if (Store.repairMode || (!item && !picked)) return;
          onPutAway();
        }}
      >
        {/* The silhouette of what goes here, while nothing does. */}
        {!item && (
          <MuSpriteFrame
            file={sprite}
            width={width}
            height={height}
            className="equipment-slot-back"
          />
        )}
        {!!item && (
          <span className="equipment-slot-item">
            <ItemIcon item={item} />
          </span>
        )}
        {!!item && (item.lvl ?? 0) > 0 && <span className="item-level">+{item.lvl}</span>}
        {durability !== null && (
          <span className={`durability ${durabilityClass(durability)}`}>
            <span style={{ width: `${Math.max(0, Math.min(100, durability))}%` }} />
          </span>
        )}
      </div>
    );
  }
);

type HoverInfo = { item: Item; slot: number; x: number; y: number };

/**
 * What the window is doing besides the bag: selecting items to sell in one go, confirming the junk
 * the server found, or confirming a page to unlock (D33).
 */
type Mode =
  | { kind: 'normal' }
  | { kind: 'batch'; selected: number[]; stored: number[] }
  | { kind: 'junk' }
  | { kind: 'buy'; page: number };

const NORMAL: Mode = { kind: 'normal' };

/** The first storage slot of a storage page (IV to VII): page IV starts at 0. */
function storageFirstSlot(page: number): number {
  return (page - SLOT_PAGES - 1) * SQUARES;
}

/** The storage's 256 slots (pages IV to VII), as the grid reads them. */
const STORAGE_SLOTS = 256;

/** V stays a second inventory key unless the user binds it elsewhere. */
const ALT_HOT_KEY = 'KeyV';

const ITEM_HOT_KEYS = ITEM_HOTKEY_CODES;

/** The worn items "Repair all" mends: every slot but the pet's (the pet trainer does pets). */
const REPAIRED_SLOTS = EQUIPMENT_SLOTS.map(info => info.slot).filter(
  slot => slot !== InventoryConstants.PetSlot
);

export const Inventory = observer(() => {
  const playerData = Store.playerData;
  const gridRef = useRef<HTMLDivElement>(null);

  const [target, setTarget] = useState<{ column: number; row: number } | null>(null);
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [split, setSplit] = useState<SplitRequest | null>(null);
  const [page, setPage] = useState(1);
  const [mode, setMode] = useState<Mode>(NORMAL);

  // The pages in the inventory's slots (I to III), and every page the character has (IV to VII
  // are the storage pages, D33).
  const unlocked = InventoryPages.unlocked;
  const pages = MUIdle.inventoryPages;
  // Pages are bought in order: storage pages only once the three inventory pages are there.
  const total = unlocked < SLOT_PAGES ? unlocked : Math.max(unlocked, pages.unlocked);
  const current = Math.min(page, total);
  const storagePage = current > SLOT_PAGES;
  const first = storagePage ? storageFirstSlot(current) : pageFirstSlot(current);

  // The storage pages as one item array by storage slot, like `playerData.items` for the bag.
  const stored = MUIdle.storedItems;
  const storedArray = useMemo(() => {
    const items = new Array<Item | null>(STORAGE_SLOTS).fill(null);
    for (const entry of stored) if (entry.slot >= 0 && entry.slot < STORAGE_SLOTS) items[entry.slot] = entry.item;
    return items;
  }, [stored]);
  const source = storagePage ? storedArray : playerData.items;

  const picked = Store.pickedItem;
  const pickedSize = picked ? itemSize(picked.item) : null;

  const stamp = occupancyStamp(source, first, SQUARES);
  const { squares, placed } = useMemo(
    () => buildOccupancy(source, first),
    // `stamp` stands in for the item contents.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [source, stamp, first]
  );
  const used = useMemo(() => usedMask(squares), [squares]);
  // The handlers read the latest occupancy without being recreated.
  const latest = useRef({ squares, pickedSize });
  latest.current = { squares, pickedSize };

  // Squares in use on every page the character has, for the counter beside the tabs.
  const allStamp = occupancyStamp(playerData.items, pageFirstSlot(1), unlocked * SQUARES);
  const usedSquares = useMemo(() => {
    let count = 0;
    for (let p = 1; p <= unlocked; p++) {
      for (const entry of buildOccupancy(playerData.items, pageFirstSlot(p)).squares) {
        if (entry) count++;
      }
    }
    for (let p = SLOT_PAGES + 1; p <= total; p++) {
      for (const entry of buildOccupancy(storedArray, storageFirstSlot(p)).squares) {
        if (entry) count++;
      }
    }
    return count;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerData.items, allStamp, unlocked, storedArray, total]);

  // The junk preview answers "Sell junk": nothing to sell ends the mode with a word.
  const junk = MUIdle.junkPreview;
  useEffect(() => {
    if (mode.kind !== 'junk' || !junk || junk.slots.length > 0) return;
    Store.addNotification(mt('inv.junkNone'), 'info');
    MUIdle.clearJunkPreview();
    setMode(NORMAL);
  }, [mode.kind, junk]);

  // The selection keeps only items still there (sold, moved or looted away meanwhile).
  const selected = mode.kind === 'batch' ? mode.selected.filter(slot => !!playerData.items[slot]) : [];
  const selectedStored = mode.kind === 'batch' ? mode.stored.filter(slot => !!storedArray[slot]) : [];
  const selectedZen =
    selected.reduce((sum, slot) => sum + itemValue(playerData.items[slot]!, 1), 0) +
    selectedStored.reduce((sum, slot) => sum + itemValue(storedArray[slot]!, 1), 0);
  const selectedCount = selected.length + selectedStored.length;
  // Bag and storage slots overlap in number: each page marks its own kind.
  const marked = new Set<number>(
    storagePage
      ? selectedStored
      : mode.kind === 'batch'
        ? selected
        : mode.kind === 'junk' && junk
          ? junk.slots
          : []
  );
  const locked = new Set(
    storagePage ? stored.filter(entry => entry.locked).map(entry => entry.slot) : MUIdle.lockedSlots
  );

  const leaveMode = () => {
    if (mode.kind === 'junk') MUIdle.clearJunkPreview();
    setMode(NORMAL);
  };

  // MUIdle: a drag ends where it is let go (see liftedAt); a click keeps the item on the cursor.
  const dropRef = useRef<(clientX: number, clientY: number) => void>(() => {});
  useEffect(() => {
    const onUp = (event: PointerEvent) => {
      const from = liftedAt;
      liftedAt = null;
      if (!from || event.button !== 0 || !Store.inventoryEnabled) return;
      if (!Store.pickedItem || Store.pendingItemMove) return;
      if (Math.hypot(event.clientX - from.x, event.clientY - from.y) < DRAG_DISTANCE) return;
      dropRef.current(event.clientX, event.clientY);
    };
    window.addEventListener('pointerup', onUp);
    return () => window.removeEventListener('pointerup', onUp);
  }, []);

  useEventBus('keyPressed', key => {
    if (
      isKey('inventory', key) ||
      (key === ALT_HOT_KEY && !actionOfKey(key))
    ) {
      Store.inventoryEnabled = !Store.inventoryEnabled;
      // NewUIHotKey.cpp:198-203.
      playUiSound('click');
    }

    // The grid packs itself top-left, kind by kind; a second press stops a
    // run that is still going.
    if (isKey('sortInventory', key) && Store.inventoryEnabled) {
      InventorySort.start();
    }

    // NewUIMyInventory.cpp:578: L toggles self-repair (level 50+), only
    // while no shop is open.
    if (isKey('repair', key) && Store.inventoryEnabled && !Store.npcShop) {
      Store.toggleRepairMode();
    }

    // NewUIMyInventory.cpp:622: Ctrl+Q/W/E/R over a potion binds that bar slot.
    const bind = ITEM_HOT_KEYS.indexOf(key);
    if (bind >= 0 && Store.inventoryEnabled && hover) {
      const keys = Store.world?.keyboardInput.pressedKeys;
      const ctrl = !!keys && (keys.has('ControlLeft') || keys.has('ControlRight'));
      if (ctrl && canRegisterItemHotkey(hover.item)) {
        Store.setItemHotkey(bind, hover.item);
      }
    }
  });

  useEffect(() => {
    if (!picked) {
      setTarget(null);
      return;
    }

    const onMove = (event: PointerEvent) => {
      const size = latest.current.pickedSize;
      const grid = gridRef.current;
      if (!size || !grid) return;
      const rect = grid.getBoundingClientRect();
      const scale = rect.width / (COLUMNS * SQUARE);
      let next: { column: number; row: number } | null = null;
      if (
        scale &&
        event.clientX >= rect.left &&
        event.clientX < rect.right &&
        event.clientY >= rect.top &&
        event.clientY < rect.bottom
      ) {
        next = targetSquareAt(
          (event.clientX - rect.left) / scale,
          (event.clientY - rect.top) / scale,
          size.w,
          size.h
        );
      }
      setTarget(current =>
        current === next ||
        (current && next && current.column === next.column && current.row === next.row)
          ? current
          : next
      );
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [!!picked]);

  if (!Store.inventoryEnabled) {
    return null;
  }

  const slotOf = (column: number, row: number) => first + column + row * COLUMNS;

  const gridPoint = (clientX: number, clientY: number) => {
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) return null;

    const scale = rect.width / (COLUMNS * SQUARE);
    if (!scale) return null;

    return {
      rect,
      x: (clientX - rect.left) / scale,
      y: (clientY - rect.top) / scale,
    };
  };

  const targetFor = (clientX: number, clientY: number) => {
    if (!pickedSize) return null;

    const point = gridPoint(clientX, clientY);
    if (!point) return null;

    const { rect } = point;

    if (
      clientX < rect.left ||
      clientX >= rect.right ||
      clientY < rect.top ||
      clientY >= rect.bottom
    ) {
      return null;
    }

    return targetSquareAt(point.x, point.y, pickedSize.w, pickedSize.h);
  };

  const targetOk =
    !!target &&
    !!pickedSize &&
    canPlace(squares, target.column, target.row, pickedSize.w, pickedSize.h);

  const squareAt = (clientX: number, clientY: number) => {
    const point = gridPoint(clientX, clientY);
    if (!point) return -1;

    const column = Math.floor(point.x / SQUARE);
    const row = Math.floor(point.y / SQUARE);

    if (column < 0 || column >= COLUMNS || row < 0 || row >= ROWS) return -1;
    return row * COLUMNS + column;
  };

  /** The carried item let go over the grid: a click on it, or the end of a drag. */
  const dropOnGrid = (clientX: number, clientY: number) => {
    if (!picked || !pickedSize) return;

    // A storage page takes the item where it fits first (the server places it).
    if (storagePage) {
      storePicked(current);
      return;
    }

    // A stack dropped on the same item merges into it (the server's full / partial stack), before
    // the jewel rule below would try to use one jewel on the other.
    if (picked.fromStorage === StorageKind.Inventory) {
      const square = squareAt(clientX, clientY);
      const entry = square >= 0 ? squares[square] : null;
      if (entry && entry.slot !== picked.fromSlot && mergesWith(picked.item, entry.item)) {
        Store.pendingStackMerge = true;
        Store.placePickedItem(entry.slot);
        return;
      }
    }

    // ApplyJewels (NewUIMyInventory.cpp:2055): a carried jewel clicked on
    // an occupied square is used on that item instead of moved.
    if (isUpgradeJewel(picked.item)) {
      const square = squareAt(clientX, clientY);
      const entry = square >= 0 ? squares[square] : null;
      if (entry && entry.slot !== picked.fromSlot) {
        if (Store.applyPickedJewel(entry.slot)) return;
      }
    }

    const at = targetFor(clientX, clientY);
    if (!at) return;

    if (at.column < 0 || at.row < 0) return;

    const toSlot = slotOf(at.column, at.row);

    if (toSlot === picked.fromSlot) {
      Store.cancelPickedItem();
      return;
    }

    if (canPlace(squares, at.column, at.row, pickedSize.w, pickedSize.h)) {
      Store.placePickedItem(toSlot);
    }
  };

  /** The first free place for a w x h item: this page first, then the others the character has. */
  const freeSlotFor = (w: number, h: number): number | null => {
    const all = Array.from({ length: unlocked }, (_, i) => i + 1);
    const order = storagePage ? all : [current, ...all.filter(p => p !== current)];
    for (const p of order) {
      const pageSquares = p === current ? squares : buildOccupancy(playerData.items, pageFirstSlot(p)).squares;
      const fit = firstFit(pageSquares, w, h);
      if (fit) return pageFirstSlot(p) + fit.column + fit.row * COLUMNS;
    }
    return null;
  };

  /**
   * MUIdle: worn gear into the first free place of the bag - a right click on it, or on the bag
   * while carrying an item lifted off an equipment slot (which put it back in the hand before).
   * Anything else carried goes back where it came from, as the right click always did.
   */
  const putAway = (slot: number | null) => {
    const carried = Store.pickedItem;
    const item = carried ? carried.item : slot !== null ? playerData.items[slot] : null;
    if (!item) return;
    if (
      carried &&
      (carried.fromStorage !== StorageKind.Inventory ||
        carried.fromSlot > InventoryConstants.LastEquippableItemSlotIndex)
    ) {
      Store.cancelPickedItem();
      return;
    }

    const { w, h } = itemSize(item);
    const free = freeSlotFor(w, h);
    if (free === null) {
      Store.addNotification(t('notify.noRoomForItem'), 'error');
      if (carried) Store.cancelPickedItem();
      return;
    }

    if (!carried) {
      if (slot === null) return;
      Store.pickInventoryItem(slot);
    }
    Store.placePickedItem(free);
  };

  // The release of a drag reads this render's grid.
  dropRef.current = (clientX: number, clientY: number) => {
    const under = document.elementFromPoint(clientX, clientY);
    // Let go over a page tab: a storage tab keeps the item, another opens its page.
    const tab = under?.closest<HTMLElement>('[data-page-tab]');
    if (tab) {
      onTab(Number(tab.dataset.pageTab));
      return;
    }
    const equipment = under?.closest<HTMLElement>('[data-equipment-slot]');
    if (equipment) {
      const slot = Number(equipment.dataset.equipmentSlot);
      dropOnEquipment(slot, playerData.items[slot] ?? null);
      return;
    }
    if (under && gridRef.current?.contains(under)) dropOnGrid(clientX, clientY);
  };

  /** Batch selling: a click puts an item in or out of the sale; locked items stay out. */
  const toggleSelected = (slot: number) => {
    if (mode.kind !== 'batch' || locked.has(slot)) return;
    const toggle = (list: number[]) => (list.includes(slot) ? list.filter(s => s !== slot) : [...list, slot]);
    setMode(
      storagePage
        ? { kind: 'batch', selected, stored: toggle(selectedStored) }
        : { kind: 'batch', selected: toggle(selected), stored: selectedStored }
    );
  };

  /**
   * The carried bag item onto a storage page (IV to VII): the server moves it where it fits first and
   * takes it out of the bag; worn gear and items from other windows go back.
   */
  const storePicked = (target: number) => {
    const carried = Store.pickedItem;
    if (!carried) return;
    const fromBag =
      carried.fromStorage === StorageKind.Inventory &&
      carried.fromSlot > InventoryConstants.LastEquippableItemSlotIndex;
    Store.cancelPickedItem();
    if (fromBag) MUIdle.storeItem(carried.fromSlot, target);
  };

  const onGridPointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0) return;

    if (mode.kind === 'batch' || mode.kind === 'junk') {
      const square = squareAt(event.clientX, event.clientY);
      const entry = square >= 0 ? squares[square] : null;
      if (entry) toggleSelected(entry.slot);
      return;
    }

    if (picked && pickedSize) {
      dropOnGrid(event.clientX, event.clientY);
      return;
    }

    const square = squareAt(event.clientX, event.clientY);
    if (square < 0) return;

    const entry = squares[square];
    if (!entry) return;

    // A stored item is not lifted: a right click takes it back to the bag.
    if (storagePage) return;

    // REPAIR_MODE_ON (NewUIMyInventory.cpp:1520): the click repairs instead.
    if (Store.repairMode) {
      Store.repairItemRequest(entry.slot);
      return;
    }

    if (event.ctrlKey) {
      QuickItemActions.fromInventory(entry.slot);
      return;
    }

    // Shift + click on a stack: split pieces off it (D28) - the mixes take a set number of jewels.
    if (event.shiftKey && stackCount(entry.item) > 1) {
      setSplit({ slot: entry.slot, item: entry.item });
      return;
    }

    Store.pickInventoryItem(entry.slot);
    liftedAt = { x: event.clientX, y: event.clientY };
  };

  const onGridContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    if (mode.kind !== 'normal') return;

    // A storage page: the right click takes the item back into the bag.
    if (storagePage) {
      if (picked) {
        Store.cancelPickedItem();
        return;
      }
      const square = squareAt(event.clientX, event.clientY);
      const entry = square >= 0 ? squares[square] : null;
      if (entry) MUIdle.retrieveItem(entry.slot);
      return;
    }

    // Right button puts the hammer down.
    if (Store.repairMode) {
      Store.toggleRepairMode();
      return;
    }

    if (picked) {
      putAway(null);
      return;
    }

    const square = squareAt(event.clientX, event.clientY);
    if (square < 0) return;

    const entry = squares[square];
    if (!entry) return;

    // `ProcessMyInvenItemAutoMove` (NewUIStorageInventory.cpp:400): with a
    // storage window open the right click shuttles the item into it instead
    // of equipping or drinking it.
    const target = Economy.autoMoveTarget;
    if (target !== null) {
      Store.autoMoveItem(StorageKind.Inventory, entry.slot, target);
      return;
    }

    // Event tickets ask the server for the opening state instead of being
    // drunk (NewUIMyInventory.cpp: SendMiniGameOpeningStateRequest).
    if (events.useTicket(entry.slot, entry.item)) return;

    // Orbs, scrolls and crystals are read, not drunk
    // (NewUIMyInventory.cpp:1865): the skill is learned when the hero
    // qualifies, otherwise the reason is said.
    if (Store.learnSkillItem(entry.slot)) return;

    if (isConsumable(entry.item)) {
      Store.consumeItemRequest(entry.slot);
      return;
    }

    const destination = equipDestination(entry.item, playerData.items);
    if (destination < 0) return;

    Store.pickInventoryItem(entry.slot);
    Store.placePickedItem(destination);
  };

  /** A tab: switch to a page the character has (also while carrying an item), or offer the next one. */
  const onTab = (p: number) => {
    // A bag item dropped on a storage tab is kept there.
    if (picked && p > SLOT_PAGES && p <= total) {
      storePicked(p);
      return;
    }
    if (p <= total) {
      setPage(p);
      return;
    }
    if (picked || mode.kind === 'batch') return;
    if (p === total + 1 && p <= pages.available) setMode({ kind: 'buy', page: p });
  };

  const tabTitle = (p: number) => {
    if (p <= total) return p > SLOT_PAGES ? `${pageName(p)} - ${mt('inv.storeHint')}` : pageName(p);
    if (p > pages.available) return mt('inv.pageSoon', { page: pageName(p) });
    if (p > total + 1) return mt('inv.buyPreviousFirst', { page: pageName(total + 1) });
    return mt('inv.pageLocked', { page: pageName(p), zen: zenText(pages.prices[p - 1] ?? 0) });
  };

  const needsRepair = REPAIRED_SLOTS.some(slot => {
    const item = playerData.items[slot];
    const percent = item ? durabilityPercent(item) : null;
    return percent !== null && percent < 100;
  });

  const renderActions = () => {
    if (mode.kind === 'batch') {
      return (
        <>
          <button
            type="button"
            className="inv-btn primary wide"
            disabled={selectedCount === 0}
            title={mt('inv.batchHint')}
            onClick={() => {
              MUIdle.sellItems(selected, false, selectedStored);
              setMode(NORMAL);
            }}
          >
            {selectedCount === 0
              ? mt('inv.batchHint')
              : mt('inv.batchConfirm', { count: selectedCount, zen: zenText(selectedZen) })}
          </button>
          <button type="button" className="inv-btn narrow" onClick={leaveMode}>
            {mt('inv.cancel')}
          </button>
        </>
      );
    }

    if (mode.kind === 'junk') {
      const level = MUIdle.settings?.sellMaxItemLevel ?? 4;
      return (
        <>
          <button
            type="button"
            className="inv-btn primary wide"
            disabled={!junk || junk.slots.length === 0}
            title={mt('inv.junkRule', { level })}
            onClick={() => {
              MUIdle.sellJunk();
              setMode(NORMAL);
            }}
          >
            {junk ? mt('inv.junkConfirm', { count: junk.slots.length, zen: zenText(junk.zen) }) : '…'}
          </button>
          <button type="button" className="inv-btn narrow" onClick={leaveMode}>
            {mt('inv.cancel')}
          </button>
        </>
      );
    }

    if (mode.kind === 'buy') {
      const price = pages.prices[mode.page - 1] ?? 0;
      return (
        <>
          <button
            type="button"
            className="inv-btn primary wide"
            disabled={playerData.money < price}
            title={playerData.money < price ? mt('inv.pageZen') : undefined}
            onClick={() => {
              MUIdle.buyInventoryPage(mode.page);
              setMode(NORMAL);
            }}
          >
            {mt('inv.buyPage', { page: pageName(mode.page), zen: zenText(price) })}
          </button>
          <button type="button" className="inv-btn narrow" onClick={leaveMode}>
            {mt('inv.cancel')}
          </button>
        </>
      );
    }

    return (
      <>
        <button
          type="button"
          className="inv-btn half"
          title={mt('inv.batchHint')}
          disabled={!!picked}
          onClick={() => setMode({ kind: 'batch', selected: [], stored: [] })}
        >
          <span className="glyph">⚖</span>
          <span className="label">{mt('inv.batchSell')}</span>
        </button>
        <button
          type="button"
          className="inv-btn half"
          title={mt('inv.junkRule', { level: MUIdle.settings?.sellMaxItemLevel ?? 4 })}
          disabled={!!picked}
          onClick={() => {
            setMode({ kind: 'junk' });
            MUIdle.requestJunkPreview();
          }}
        >
          <span className="glyph">♻</span>
          <span className="label">{mt('inv.sellJunk')}</span>
        </button>
      </>
    );
  };

  return (
    <MuItemWindow
      id={WINDOW_ID}
      className={`inventory${Store.repairMode ? ' repair-mode' : ''}${mode.kind !== 'normal' ? ` mode-${mode.kind}` : ''}`}
      column={Store.characterInfoEnabled ? 1 : 0}
      onClose={() => {
        Store.inventoryEnabled = false;
        // Escape (NewUIMyInventory.cpp:582).
        playUiSound('click');
      }}
    >
      {}
      <div className="window-title" style={{ top: TITLE_Y }}>
        {t(TITLE)}
      </div>

      {}
      <div
        className="head-close"
        data-no-drag="true"
        style={{
          left: HEAD_CLOSE_X,
          top: HEAD_CLOSE_Y,
          width: HEAD_CLOSE_WIDTH,
          height: HEAD_CLOSE_HEIGHT,
        }}
        onClick={() => (Store.inventoryEnabled = false)}
      >
        ×
      </div>

      {EQUIPMENT_SLOTS.map(info => (
        <EquipmentSlot
          key={info.slot}
          {...info}
          item={playerData.items[info.slot] ?? null}
          onHover={setHover}
          onPutAway={() => putAway(info.slot)}
        />
      ))}

      <div className="inv-tabs" data-no-drag="true" style={{ left: TABS_X, top: TABS_Y, height: TAB_HEIGHT }}>
        {Array.from({ length: 7 }, (_, i) => i + 1).map(p => (
          <button
            key={p}
            type="button"
            data-page-tab={p}
            className={`inv-tab${p === current ? ' active' : ''}${p > total ? ' locked' : ''}${
              p === total + 1 && p <= pages.available ? ' next' : ''
            }${p > pages.available ? ' soon' : ''}`}
            style={{ width: TAB_WIDTH, marginRight: p < 7 ? TAB_GAP : 0 }}
            title={tabTitle(p)}
            onPointerDown={event => {
              event.stopPropagation();
              if (event.button === 0) onTab(p);
            }}
          >
            {pageName(p)}
          </button>
        ))}
      </div>
      <div className="inv-count" style={{ top: TABS_Y, height: TAB_HEIGHT }} title={mt('inv.used')}>
        {usedSquares}/{total * SQUARES}
      </div>

      <div className="inv-actions" data-no-drag="true" style={{ left: GRID_X, top: ACTIONS_Y, height: ACTIONS_HEIGHT }}>
        {renderActions()}
      </div>

      <MuTableFrame
        left={GRID_FRAME_X}
        top={GRID_FRAME_Y}
        width={GRID_FRAME_WIDTH}
        height={GRID_FRAME_HEIGHT}
      />

      <div
        ref={gridRef}
        className={`inventory-items${Store.pendingItemMove ? ' busy' : ''}`}
        data-no-drag="true"
        style={{
          left: GRID_X,
          top: GRID_Y,
          width: COLUMNS * SQUARE,
          height: ROWS * SQUARE,
        }}
        onPointerDown={onGridPointerDown}
        onContextMenu={onGridContextMenu}
        onPointerMove={event => {
          // State only moves when the hovered *item* changes, not per event.
          const square = squareAt(event.clientX, event.clientY);
          const entry = square >= 0 ? squares[square] : null;
          setHover(current => {
            if (!entry) return current === null ? current : null;
            if (current && current.item === entry.item) return current;
            return { item: entry.item, slot: entry.slot, x: event.clientX, y: event.clientY };
          });
        }}
        onPointerLeave={() => setHover(null)}
      >
        <GridSquares
          columns={COLUMNS}
          rows={ROWS}
          used={used}
          hovered=""
          squareClass="inventory-square"
        />

        {placed.map(entry => (
          <div
            key={entry.slot}
            className={`inventory-item${qualityClass(entry.item)}${marked.has(entry.slot) ? ' marked' : ''}${
              locked.has(entry.slot) ? ' locked' : ''
            }`}
            style={{
              left: entry.column * SQUARE,
              top: entry.row * SQUARE,
              width: entry.w * SQUARE,
              height: entry.h * SQUARE,
            }}
          >
            <ItemIcon item={entry.item} />
            {(entry.item.lvl ?? 0) > 0 && <span className="item-level">+{entry.item.lvl}</span>}
            {stackCount(entry.item) > 1 && (
              <span className="stack">{stackCount(entry.item)}</span>
            )}
            {locked.has(entry.slot) && <span className="lock-badge">P</span>}
          </div>
        ))}

        {!!target && !!pickedSize && (
          <div
            className={`drop-target${targetOk ? '' : ' warning'}`}
            style={{
              left: target.column * SQUARE,
              top: target.row * SQUARE,
              width: pickedSize.w * SQUARE,
              height: pickedSize.h * SQUARE,
            }}
          />
        )}

      </div>

      {}
      {!picked && !!hover && (
        <ItemTooltip
          item={hover.item}
          x={hover.x}
          y={hover.y}
          context={storagePage ? 'plain' : 'inventory'}
          slot={hover.slot}
        />
      )}

      <div className="inv-money" style={{ left: MONEY_X, top: FOOTER_Y, width: MONEY_WIDTH, height: FOOTER_HEIGHT }}>
        <span className="coin" />
        <span className="amount">{zenText(playerData.money)}</span>
      </div>

      <button
        type="button"
        className={`inv-btn icon${Economy.myShopOpen ? ' checked' : ''}`}
        data-no-drag="true"
        title={t(SHOP_TOOLTIP)}
        style={{ left: SHOP_BUTTON_X, top: FOOTER_Y, width: SHOP_BUTTON_SIZE, height: FOOTER_HEIGHT }}
        onClick={() => Economy.toggleMyShop()}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M2 6h12l-1-3H3zM3 7v6h4v-4h2v4h4V7" fill="none" stroke="currentColor" strokeWidth="1.3" />
        </svg>
      </button>

      <button
        type="button"
        className="inv-btn repair-all"
        data-no-drag="true"
        disabled={!needsRepair}
        title={needsRepair ? mt('inv.repairAll') : mt('inv.repairNothing')}
        style={{ left: REPAIR_ALL_X, top: FOOTER_Y, width: REPAIR_ALL_WIDTH, height: FOOTER_HEIGHT }}
        onClick={() => MUIdle.repairAll()}
      >
        {mt('inv.repairAll')}
      </button>

      {}
      {split && <SplitStackDialog request={split} onClose={() => setSplit(null)} />}
    </MuItemWindow>
  );
});

