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
import { goldColor } from '../../../../../common/goldColor';
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
import { useEffect, useMemo, useRef, useState } from 'react';
import { MuSpriteFrame } from '../../../../components/muSprite';
import { MuButton } from '../../../../components/muButton';
import { MuItemWindow, MuTableFrame } from '../../../../components/muWindow';
import { playUiSound } from '../../../../../libs/sfx';
import {
  BUTTON_FRAMES,
  BUTTON_HEIGHT,
  BUTTON_WIDTH,
  BUTTON_Y,
  COLUMNS,
  EQUIPMENT_SLOTS,
  EXIT_BUTTON_X,
  EXIT_SPRITE,
  EXIT_TOOLTIP,
  EXPAND_BUTTON_X,
  EXPAND_SPRITE,
  EXPAND_TOOLTIP,
  FIRST_SLOT,
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
  MONEY_HEIGHT,
  MONEY_SPRITE,
  MONEY_TEXT_X,
  MONEY_TEXT_Y,
  MONEY_WIDTH,
  MONEY_X,
  MONEY_Y,
  REPAIR_BUTTON_X,
  REPAIR_SPRITE,
  REPAIR_TOOLTIP,
  ROWS,
  SHOP_BUTTON_X,
  SHOP_SPRITE,
  SHOP_TOOLTIP,
  SQUARE,
  SQUARES,
  TITLE,
  TITLE_Y,
} from './layout';

const WINDOW_ID = 'inventory';

function slotOf(column: number, row: number): number {
  return column + row * COLUMNS + FIRST_SLOT;
}

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

function buildOccupancy(items: (Item | null)[]) {
  const squares: (Placed | null)[] = new Array(SQUARES).fill(null);
  const placed: Placed[] = [];

  for (let square = 0; square < SQUARES; square++) {
    const slot = FIRST_SLOT + square;
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

/** The first place (row by row, from the top left) a w x h item fits at; null in a full bag. */
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

    return (
      <div
        className={`equipment-slot${fits ? ' can-equip' : ''}${
          blocked ? ' blocked' : ''
        }`}
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
        <MuSpriteFrame
          file={sprite}
          width={width}
          height={height}
          className="equipment-slot-back"
        />
        {!!item && (
          <span className="equipment-slot-item">
            <ItemIcon item={item} />
          </span>
        )}
      </div>
    );
  }
);

type HoverInfo = { item: Item; slot: number; x: number; y: number };

/** V stays a second inventory key unless the user binds it elsewhere. */
const ALT_HOT_KEY = 'KeyV';

const ITEM_HOT_KEYS = ITEM_HOTKEY_CODES;

export const Inventory = observer(() => {
  const playerData = Store.playerData;
  const gridRef = useRef<HTMLDivElement>(null);

  const [target, setTarget] = useState<{ column: number; row: number } | null>(null);
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [split, setSplit] = useState<SplitRequest | null>(null);

  const picked = Store.pickedItem;
  const pickedSize = picked ? itemSize(picked.item) : null;

  const stamp = occupancyStamp(playerData.items, FIRST_SLOT, SQUARES);
  const { squares, placed } = useMemo(
    () => buildOccupancy(playerData.items),
    // `stamp` stands in for the item contents.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [playerData.items, stamp]
  );
  const used = useMemo(() => usedMask(squares), [squares]);
  // The handlers read the latest occupancy without being recreated.
  const latest = useRef({ squares, pickedSize });
  latest.current = { squares, pickedSize };

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

  /**
   * MUIdle: worn gear into the first free place of the bag - a right click on it, or on the bag
   * while carrying an item lifted off an equipment slot (which put it back in the hand before).
   * Anything else carried goes back where it came from, as the right click always did.
   */
  const putAway = (slot: number | null) => {
    const carried = Store.pickedItem;
    const item = carried ? carried.item : slot !== null ? playerData.items[slot] : null;
    if (!item) return;
    if (carried && (carried.fromStorage !== StorageKind.Inventory || carried.fromSlot >= FIRST_SLOT)) {
      Store.cancelPickedItem();
      return;
    }

    const { w, h } = itemSize(item);
    const fit = firstFit(squares, w, h);
    if (!fit) {
      Store.addNotification(t('notify.noRoomForItem'), 'error');
      if (carried) Store.cancelPickedItem();
      return;
    }

    if (!carried) {
      if (slot === null) return;
      Store.pickInventoryItem(slot);
    }
    Store.placePickedItem(slotOf(fit.column, fit.row));
  };

  // The release of a drag reads this render's grid.
  dropRef.current = (clientX: number, clientY: number) => {
    const under = document.elementFromPoint(clientX, clientY);
    const equipment = under?.closest<HTMLElement>('[data-equipment-slot]');
    if (equipment) {
      const slot = Number(equipment.dataset.equipmentSlot);
      dropOnEquipment(slot, playerData.items[slot] ?? null);
      return;
    }
    if (under && gridRef.current?.contains(under)) dropOnGrid(clientX, clientY);
  };

  const onGridPointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0) return;

    if (picked && pickedSize) {
      dropOnGrid(event.clientX, event.clientY);
      return;
    }

    const square = squareAt(event.clientX, event.clientY);
    if (square < 0) return;

    const entry = squares[square];
    if (!entry) return;

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

  return (
    <MuItemWindow
      id={WINDOW_ID}
      className={`inventory${Store.repairMode ? ' repair-mode' : ''}`}
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
      />

      {EQUIPMENT_SLOTS.map(info => (
        <EquipmentSlot
          key={info.slot}
          {...info}
          item={playerData.items[info.slot] ?? null}
          onHover={setHover}
          onPutAway={() => putAway(info.slot)}
        />
      ))}

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
            className="inventory-item"
            style={{
              left: entry.column * SQUARE,
              top: entry.row * SQUARE,
              width: entry.w * SQUARE,
              height: entry.h * SQUARE,
            }}
          >
            <ItemIcon item={entry.item} />
            {stackCount(entry.item) > 1 && (
              <span className="stack">{stackCount(entry.item)}</span>
            )}
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
          context="inventory"
          slot={hover.slot}
        />
      )}

      {}
      <MuSpriteFrame
        file={MONEY_SPRITE}
        width={MONEY_WIDTH}
        height={MONEY_HEIGHT}
        style={{ position: 'absolute', left: MONEY_X, top: MONEY_Y }}
      />
      <div
        className="inventory-money"
        style={{
          left: MONEY_TEXT_X,
          top: MONEY_TEXT_Y,
          color: goldColor(playerData.money),
        }}
      >
        {playerData.money.toLocaleString('en-US')}
      </div>

      <div data-no-drag="true" className="window-button" style={{ left: EXIT_BUTTON_X, top: BUTTON_Y }}>
        <MuButton
          file={EXIT_SPRITE}
          width={BUTTON_WIDTH}
          height={BUTTON_HEIGHT}
          frames={BUTTON_FRAMES}
          onClick={() => (Store.inventoryEnabled = false)}
        >
          <span className="button-tooltip">{t(EXIT_TOOLTIP)}</span>
        </MuButton>
      </div>
      {}
      <div
        className="window-button"
        data-no-drag="true"
        style={{ left: REPAIR_BUTTON_X, top: BUTTON_Y }}
      >
        <MuButton
          file={REPAIR_SPRITE}
          width={BUTTON_WIDTH}
          height={BUTTON_HEIGHT}
          frames={BUTTON_FRAMES}
          disabled={!Store.canRepair}
          checked={Store.repairMode}
          onClick={() => Store.toggleRepairMode()}
        >
          <span className="button-tooltip">{t(REPAIR_TOOLTIP)}</span>
        </MuButton>
      </div>
      <div
        className="window-button"
        data-no-drag="true"
        style={{ left: SHOP_BUTTON_X, top: BUTTON_Y }}
      >
        {}
        <MuButton
          file={SHOP_SPRITE}
          width={BUTTON_WIDTH}
          height={BUTTON_HEIGHT}
          frames={BUTTON_FRAMES}
          checked={Economy.myShopOpen}
          onClick={() => Economy.toggleMyShop()}
        >
          <span className="button-tooltip">{t(SHOP_TOOLTIP)}</span>
        </MuButton>
      </div>
      <div
        className="window-button"
        data-no-drag="true"
        style={{ left: EXPAND_BUTTON_X, top: BUTTON_Y }}
      >
        <MuButton
          file={EXPAND_SPRITE}
          width={BUTTON_WIDTH}
          height={BUTTON_HEIGHT}
          frames={BUTTON_FRAMES}
          disabled
        >
          <span className="button-tooltip">{t(EXPAND_TOOLTIP)}</span>
        </MuButton>
      </div>

      {}
      {}
      {split && <SplitStackDialog request={split} onClose={() => setSplit(null)} />}
    </MuItemWindow>
  );
});
