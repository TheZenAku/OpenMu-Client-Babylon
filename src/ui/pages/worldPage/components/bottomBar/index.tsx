import { uiClick } from '../../../../../libs/sfx';
import { t } from '../../../../../i18n';
import { mt } from '../../../../../muidle/text';
import './style.less';
import { observer } from 'mobx-react-lite';
import { Store } from '../../../../../store';
import { ItemIcon } from '../../../../components/itemIcon';
import { MuButton } from '../../../../components/muButton';
import { Item } from '../../../../../ecs/world';
import {
  MuResizeGrip,
  useWindowStackEntry,
} from '../../../../components/muWindow/useWindowChrome';
import { MuWindows } from '../../../../components/muWindow/windowState';
import { SkillIcon } from '../../../../components/skillIcon';
import { PetCommandBar, PET_COMMAND_BAR_HEIGHT, PET_COMMAND_BAR_WIDTH } from './petCommands';
import { MAIN_FRAME_BUTTONS, MAIN_FRAME_BUTTON_FRAMES } from './mainFrameButtons';
import { isKey } from '../../../../../common/keyBindings';
import { BOTTOM_BAR_HEIGHT, BOTTOM_BAR_ID } from '../../../../components/muWindow';
import { skillDefinition } from '../../../../../common/skillsDatabase';
import { isHotbarSkill, SKILL_ICON_HEIGHT, SKILL_ICON_WIDTH } from '../../../../../common/skillCasting';
import { useEventBus } from '../../../../../hooks/useEventBus';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { skills } from '../../../../../skills';
import { onCooldownTick, skillCooldowns } from '../../../../../skills/cooldowns';
import { SkillTooltip } from '../../../../components/skillTooltip';
import { ExpTooltip } from './expTooltip';
import { SessionStats } from '../../../../../common/sessionStats';
import { devQuery } from '../../../../../common/devSeams';
import { itemBaseName } from '../../../../../common/itemsDatabase';
import { isMobileDevice } from '../../../../../common/mobile';
import {
  ITEM_HOTKEY_CODES,
  canRegisterItemHotkey,
  countHotkeyItems,
  findHotkeyItem,
} from '../../../../../common/itemHotkeys';
import { HuntPanel } from '../muidle/huntPanel';
import { StatsPanel } from './statsPanel';
import { formatNumber } from '../playerFrame';

/**
 * The bottom bar in the Vael layout (the owner's reference): HUNT on the left, the skills with the
 * potions and the experience in the middle, the rates on the right, the window buttons in a column at
 * the end. Life, mana, SD and AG moved to the hero's frame (PlayerFrame). The behaviour is the
 * original's main frame - the hot keys 1..9 / 0 (all ten on show, no page flipping), Q W E R, the
 * current-skill box and its fan, Ctrl+digit and drag binding - only the arrangement is new.
 *
 * A touch screen keeps only the middle and the window buttons: its HUNT button floats (MUIdleHud),
 * and the skill pad fires the skills.
 */

const BAR_ID = BOTTOM_BAR_ID;
/** The skill fan is a window for Escape's purposes, nothing more. */
const SKILL_FAN_ID = 'skill-fan';

const COMPACT = isMobileDevice();

const BAR_HEIGHT = BOTTOM_BAR_HEIGHT;
const PANEL_GAP = 6;
const HUNT_WIDTH = 214;
const CENTER_WIDTH = 684;
const STATS_WIDTH = 194;
const MENU_WIDTH = 22;

const CENTER_X = COMPACT ? 0 : HUNT_WIDTH + PANEL_GAP;
const STATS_X = CENTER_X + CENTER_WIDTH + PANEL_GAP;
const MENU_X = COMPACT ? CENTER_X + CENTER_WIDTH + 4 : STATS_X + STATS_WIDTH + 4;
const BAR_WIDTH = MENU_X + MENU_WIDTH;
// Fitted to the viewport like a window, so a portrait phone shows the whole bar.
MuWindows.setFixedSize(BAR_ID, { width: BAR_WIDTH, height: BAR_HEIGHT });

/** The skill and potion boxes. */
const SLOT_WIDTH = 40;
const SLOT_HEIGHT = 48;
const SLOT_STEP = 43;
const SLOT_Y = 14;
const CURRENT_SKILL_X = CENTER_X + 10;
const HOTKEY_SLOTS_X = CURRENT_SKILL_X + SLOT_WIDTH + 10;
const POTION_X = HOTKEY_SLOTS_X + 10 * SLOT_STEP - 3 + 12;
const HOTKEY_KEYS = ['Q', 'W', 'E', 'R'];

/** The 20x28 skill icon, drawn larger in the 40x48 box (`RenderSkillIcon` drew it 1:1 in 32x38). */
const SKILL_ICON_SCALE = 1.4;
const SKILL_ICON_X = Math.round((SLOT_WIDTH - SKILL_ICON_WIDTH * SKILL_ICON_SCALE) / 2);
const SKILL_ICON_Y = 3;

const EXP_X = CENTER_X + 10;
const EXP_WIDTH = CENTER_WIDTH - 20;
const EXP_TEXT_Y = SLOT_Y + SLOT_HEIGHT + 5;
const EXP_Y = EXP_TEXT_Y + 16;
const EXP_HEIGHT = 8;

const MENU_BUTTON_HEIGHT = 18;
const MENU_BUTTON_STEP = 20;

/**
 * One Q/W/E/R slot (`CNewUIItemHotKey`): shows the best matching potion the
 * inventory holds right now and the summed count. Right click drinks it
 * (`UseItemRButton`); a carried potion dropped here binds the slot to that
 * kind, the way Ctrl+key over the inventory does.
 */
const ConsumableItem = observer(({ index, hotKey }: { index: number; hotKey: string }) => {
  const items = Store.playerData.items;
  const hotkey = Store.itemHotkeys[index];
  const slot = findHotkeyItem(items, index, hotkey);
  const icon: Item | null = slot >= 0 ? items[slot] : null;
  const count = slot >= 0 ? countHotkeyItems(items, index, hotkey) : 0;
  const picked = Store.pickedItem;
  const canBind = !!picked && canRegisterItemHotkey(picked.item);
  const name = icon ? itemBaseName(icon.group, icon.num) : undefined;

  return (
    <div
      className={`consumable-item${canBind ? ' can-bind' : ''}${icon ? '' : ' empty'}`}
      title={
        name
          ? t('bottomBar.itemSlot', { name, key: hotKey })
          : t('bottomBar.emptySlot', { key: hotKey })
      }
      style={{
        left: POTION_X + index * SLOT_STEP,
        top: SLOT_Y,
        width: SLOT_WIDTH,
        height: SLOT_HEIGHT,
      }}
      onPointerDown={event => {
        if (event.button !== 0 || !picked) return;
        event.stopPropagation();
        if (!canBind) return;
        Store.setItemHotkey(index, picked.item);
        Store.cancelPickedItem();
      }}
      onContextMenu={event => {
        event.preventDefault();
        event.stopPropagation();
        Store.useItemHotkey(index);
      }}
    >
      {!!icon && (
        <div className="consumable-icon">
          <ItemIcon item={icon} />
        </div>
      )}
      <span className="slot-key">{hotKey}</span>
      {count > 0 && <span className="slot-count">{count}</span>}
    </div>
  );
});

const HOTKEY_CODES = ITEM_HOTKEY_CODES;

const ConsumableItems = () => {
  useEventBus('keyPressed', code => {
    const i = HOTKEY_CODES.indexOf(code);
    if (i < 0) return;
    // Ctrl+key over the inventory binds; that is the inventory's job.
    const keys = Store.world?.keyboardInput.pressedKeys;
    if (keys && (keys.has('ControlLeft') || keys.has('ControlRight'))) return;
    Store.useItemHotkey(i);
  });

  return (
    <>
      {HOTKEY_KEYS.map((key, i) => (
        <ConsumableItem key={key} index={i} hotKey={key} />
      ))}
    </>
  );
};

/** One of the five window buttons (shop, character, inventory, friends, options), in a column. */
const BarButton = ({
  index,
  file,
  title,
  onClick,
}: {
  index: number;
  file: string;
  title: string;
  onClick?: () => void;
}) => (
  <div
    className="bar-button"
    title={title}
    style={{ left: MENU_X, top: 4 + index * MENU_BUTTON_STEP }}
  >
    <MuButton
      file={file}
      width={MENU_WIDTH}
      height={MENU_BUTTON_HEIGHT}
      frames={MAIN_FRAME_BUTTON_FRAMES}
      onClick={onClick}
    />
  </div>
);

/** The thin strip is hard to aim at; the hover area reaches past it. */
const EXP_HOVER_PAD = 6;

/**
 * The experience of the level (or the master level, once the hero levels as a master: the
 * original's `Exbar_Master` branch), as numbers over a gilt strip - "375.822 / 3.437.200 · 10.93%".
 */
export const ExpBar = observer(() => {
  const master = skills.inMasterProgression;
  const p = Store.playerData;
  const progress = master ? skills.masterExpPercent : p.expPercent;
  const current = master ? skills.masterExperience.current : p.exp - p.currentLvlExp;
  const needed = master ? skills.masterExperience.next : p.expToNextLvl - p.currentLvlExp;
  const hover = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null);

  // Dev seam: `?exptip` pins the tip open over the middle of the strip, so a
  // headless shot can show it. Null outside the dev build.
  useEffect(() => {
    if (devQuery('exptip') === null) return;
    const rect = hover.current?.getBoundingClientRect();
    if (rect) setTip({ x: rect.left + rect.width / 2, y: rect.top });
  }, []);

  return (
    <>
      <div className="exp-text" style={{ left: EXP_X, top: EXP_TEXT_Y, width: EXP_WIDTH }}>
        {master && <span className="exp-master">{mt('hud.master')}</span>}
        <span className="exp-numbers">
          {formatNumber(Math.max(0, current))} / {formatNumber(Math.max(0, needed))}
        </span>
        <span className="exp-percent">{(progress * 100).toFixed(2)}%</span>
      </div>
      <div className={`exp-track${master ? ' is-master' : ''}`} style={{ left: EXP_X, top: EXP_Y, width: EXP_WIDTH, height: EXP_HEIGHT }}>
        <div className="exp-fill" style={{ width: `${progress * 100}%` }} />
      </div>
      <div
        ref={hover}
        className="exp-hover"
        style={{
          left: EXP_X,
          top: EXP_TEXT_Y - 2,
          width: EXP_WIDTH - 14,
          height: EXP_Y + EXP_HEIGHT - EXP_TEXT_Y + EXP_HOVER_PAD,
        }}
        onPointerEnter={() => SessionStats.watch()}
        onPointerMove={e => setTip({ x: e.clientX, y: e.clientY })}
        onPointerLeave={() => setTip(null)}
      />
      {tip && <ExpTooltip x={tip.x} y={tip.y} />}
    </>
  );
});

/** Every hot key in bar order: the slot index *is* the digit that fires it. */
const ALL_SLOTS: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];
/** Pixels the pointer must travel before a press becomes a drag, not a click. */
const DRAG_THRESHOLD = 4;
/** RenderSkillDelay: red at half alpha rising from the slot's floor. */
const DELAY_TINT = 'rgba(255, 128, 128, 0.5)';
/** Drop targets: a digit slot is 0..9; the current-skill box; nothing. */
const DROP_CURRENT = -2;
const DROP_NONE = -1;

/**
 * The learned-skill fan (`m_bSkillList`, NewUIMainFrameWindow.cpp:1546): boxes over the bar from the
 * current-skill box rightwards, a row of `FAN_ROW`, further rows above.
 */
const FAN_ROW = 14;
const FAN_Y = -(SLOT_HEIGHT + 10);

function fanPosition(count: number): { left: number; top: number } {
  return {
    left: CURRENT_SKILL_X + (count % FAN_ROW) * SLOT_STEP,
    top: FAN_Y - Math.floor(count / FAN_ROW) * (SLOT_HEIGHT + 3),
  };
}

type SkillDrag = { number: number; x: number; y: number; moved: boolean; fromFan: boolean };

/**
 * The ghost icon under the cursor while a skill is dragged off the bar
 * (CNewUIPickedItem-style, portalled so the bar's scale does not apply).
 */
const SkillDragGhost = ({ drag }: { drag: SkillDrag }) =>
  createPortal(
    <div
      className="skill-drag-ghost"
      style={{
        left: drag.x - SKILL_ICON_WIDTH / 2,
        top: drag.y - SKILL_ICON_HEIGHT / 2,
      }}
    >
      <SkillIcon number={drag.number} />
    </div>,
    document.body
  );

/** The skill's cost as the box prints it under the icon: mana, else AG. */
function costText(number: number): string {
  const definition = skillDefinition(number);
  if (!definition) return '';
  if (definition.mana > 0) return `${definition.mana} MP`;
  if (definition.ag > 0) return `${definition.ag} AG`;
  return '';
}

/**
 * CNewUISkillList: the ten hot keys 1..9, 0 in a row, the slot index being the digit that fires it.
 *
 * A click on a bound slot makes it the current skill; a click on an *empty*
 * slot (and a right click on a bound one) opens the fan of every learned
 * skill (`m_bSkillList`) as a picker for that slot - the box after the last
 * skill clears it. A click on the current-skill box opens the same fan to
 * select rather than bind, and a right click there goes back to the plain
 * attack. Ctrl+digit over an icon binds that key (`SetHotKey`), as does
 * dropping a dragged skill on a slot; dropping one on the current-skill box
 * selects it. Icons the hero cannot use are greyed (bCantSkill), a running
 * delay sweeps the slot red from the bottom with the seconds left
 * (RenderSkillDelay), the box prints the skill's cost, and hovering shows
 * RenderSkillInfo.
 */
const SkillSlots = observer(() => {
  const [listOpen, setListOpen] = useState(false);
  /** The slot the open fan is picking for; -1 = it is only browsing. */
  const [assignSlot, setAssignSlot] = useState(-1);
  const [hovered, setHovered] = useState(-1);
  const [tip, setTip] = useState<{ number: number; x: number; y: number } | null>(null);
  const [drag, setDrag] = useState<SkillDrag | null>(null);
  const [dropSlot, setDropSlot] = useState(DROP_NONE);
  const skillList = Store.skills;

  const closeList = () => {
    setListOpen(false);
    setAssignSlot(-1);
  };
  useWindowStackEntry(SKILL_FAN_ID, listOpen, () => {
    closeList();
    return true;
  });
  /** Open the fan as the picker for one hot key. */
  const openPicker = (slot: number) => {
    setTip(null);
    setAssignSlot(slot);
    setListOpen(true);
  };
  // RenderSkillDelay: the sweep's height is written straight to the element
  // on the cooldown layer's tick, so a running delay renders nothing. The
  // observable map only changes when a delay starts / ends (slot re-render).
  const delayRefs = useRef<(HTMLDivElement | null)[]>([]);
  const secondsRefs = useRef<(HTMLDivElement | null)[]>([]);
  const slotNumbers = useRef<number[]>([]);
  useEffect(() => {
    const sweep = () => {
      const numbers = slotNumbers.current;
      for (let i = 0; i < numbers.length; i++) {
        const el = delayRefs.current[i];
        if (!el) continue;
        const delay = numbers[i] >= 0 ? skills.cooldown(numbers[i]) : null;
        const css = delay ? Math.round(delay.fraction * SLOT_HEIGHT) + 'px' : '0px';
        if (el.style.height !== css) el.style.height = css;
        const seconds = secondsRefs.current[i];
        if (!seconds) continue;
        // Whole seconds from one up, one decimal under it: the reading a
        // player counts under their breath.
        const text = delay
          ? delay.remaining >= 1
            ? `${Math.ceil(delay.remaining)}s`
            : `${delay.remaining.toFixed(1)}s`
          : '';
        if (seconds.textContent !== text) seconds.textContent = text;
      }
    };
    sweep();
    return onCooldownTick(sweep);
  });
  const fanSkills = skillList.map(s => s.number).filter(isHotbarSkill);

  useEventBus('keyPressed', code => {
    const m = /^(?:Digit|Numpad)(\d)$/.exec(code);
    if (!m) return;
    const slot = +m[1];
    const keys = Store.world?.keyboardInput.pressedKeys;
    const ctrl = !!keys && (keys.has('ControlLeft') || keys.has('ControlRight'));
    // Ctrl+digit over a slot, or a digit while dragging, binds the key.
    const bind = drag?.number ?? (ctrl ? hovered : -1);
    if (bind >= 0) {
      Store.assignSkillHotkey(slot, bind);
      return;
    }
    const number = Store.skillHotkeys[slot];
    if (number >= 0) Store.selectSkill(number);
  });

  // The drag lives on the window: the pointer leaves the bar at once.
  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) =>
      setDrag(d => {
        if (!d) return d;
        const moved = d.moved || Math.hypot(e.clientX - d.x, e.clientY - d.y) > DRAG_THRESHOLD;
        return { ...d, x: e.clientX, y: e.clientY, moved };
      });
    const onUp = () => {
      if (!drag.moved) {
        // A click in the fan binds while the fan is a picker and otherwise
        // selects; either way it closes (NewUIMainFrameWindow.cpp:1636).
        if (drag.fromFan && assignSlot >= 0) Store.assignSkillHotkey(assignSlot, drag.number);
        else Store.selectSkill(drag.number);
        if (drag.fromFan) {
          setListOpen(false);
          setAssignSlot(-1);
        }
      } else if (dropSlot >= 0) {
        Store.assignSkillHotkey(dropSlot, drag.number);
      } else if (dropSlot === DROP_CURRENT) {
        Store.selectSkill(drag.number);
      }
      setDrag(null);
      setDropSlot(DROP_NONE);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [drag, dropSlot, assignSlot]);

  const hotkeyOf = (number: number) => {
    const i = Store.skillHotkeys.indexOf(number);
    return i < 0 ? '' : String(i);
  };

  const dragging = !!drag?.moved;
  const leaveDrop = (slot: number) => setDropSlot(s => (s === slot ? DROP_NONE : s));

  /** Pointer handlers shared by the bar slots and the fan boxes. */
  const boxEvents = (number: number, fromFan: boolean) => ({
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0 || number < 0) return;
      e.stopPropagation();
      uiClick(() => {})();
      setTip(null);
      setDrag({ number, x: e.clientX, y: e.clientY, moved: false, fromFan });
    },
    onPointerEnter: () => setHovered(number),
    onPointerMove: (e: React.PointerEvent) => {
      if (number >= 0 && !drag) setTip({ number, x: e.clientX, y: e.clientY });
    },
    onPointerLeave: () => {
      setHovered(h => (h === number ? -1 : h));
      setTip(t => (t?.number === number ? null : t));
    },
  });

  const icon = (number: number, disabled: boolean) => (
    <div className="skill-icon" style={{ left: SKILL_ICON_X, top: SKILL_ICON_Y, transform: `scale(${SKILL_ICON_SCALE})` }}>
      <SkillIcon number={number} disabled={disabled} />
    </div>
  );

  return (
    <>
      {ALL_SLOTS.map((slot, i) => {
        const number = Store.skillHotkeys[slot] ?? -1;
        const state = number >= 0 ? skills.usability(number) : null;
        const usable = !!state?.requirementsMet;
        const shortOn =
          usable && state
            ? state.blocks.find(block => block === 'mana' || block === 'ag')
            : undefined;
        // Tracked: a delay starting or ending re-renders the slot (the sweep itself is not React).
        const cooling = number >= 0 && skillCooldowns.has(number);
        const selected = number >= 0 && number === Store.currentSkill;
        const picking = listOpen && assignSlot === slot;
        const name = skillDefinition(number)?.name ?? `#${number}`;
        slotNumbers.current[i] = number;
        const classes = ['skill-slot'];
        if (selected) classes.push('selected');
        if (number >= 0 && !usable) classes.push('unusable');
        if (shortOn) classes.push(shortOn === 'mana' ? 'no-mana' : 'no-ag');
        if (number < 0) classes.push('empty');
        if (picking) classes.push('picking');
        if (cooling) classes.push('cooling');
        if (dragging && dropSlot === slot) classes.push('drop-target');
        const events = boxEvents(number, false);
        return (
          <div
            key={slot}
            className={classes.join(' ')}
            title={
              number >= 0
                ? t('bottomBar.boundSlot', { name, key: slot })
                : t('bottomBar.pickSkill', { key: slot })
            }
            style={{
              left: HOTKEY_SLOTS_X + i * SLOT_STEP,
              top: SLOT_Y,
              width: SLOT_WIDTH,
              height: SLOT_HEIGHT,
            }}
            {...events}
            onPointerEnter={() => {
              events.onPointerEnter();
              if (dragging) setDropSlot(slot);
            }}
            onPointerLeave={() => {
              events.onPointerLeave();
              leaveDrop(slot);
            }}
            onPointerDown={e => {
              // An empty box is the "choose a skill" button; a bound one drags.
              if (e.button === 0 && number < 0) {
                e.stopPropagation();
                uiClick(() => openPicker(slot))();
                return;
              }
              events.onPointerDown(e);
            }}
            onContextMenu={e => {
              e.preventDefault();
              e.stopPropagation();
              uiClick(() => openPicker(slot))();
            }}
          >
            {number >= 0 && icon(number, !usable)}
            {cooling && (
              <>
                <div
                  ref={el => (delayRefs.current[i] = el)}
                  className="skill-delay"
                  style={{ height: 0, background: DELAY_TINT }}
                />
                <div ref={el => (secondsRefs.current[i] = el)} className="skill-delay-left" />
              </>
            )}
            {number >= 0 && <div className="skill-cost">{costText(number)}</div>}
            <div className="skill-hotkey">{slot}</div>
          </div>
        );
      })}
      <div
        className={[
          'skill-slot current',
          Store.currentSkill >= 0 ? 'selected' : '',
          dragging && dropSlot === DROP_CURRENT ? 'drop-target' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        title={
          dragging
            ? undefined
            : (skillDefinition(Store.currentSkill)?.name ??
                t('bottomBar.noSkill')) + t('bottomBar.skillHint')
        }
        style={{
          left: CURRENT_SKILL_X,
          top: SLOT_Y,
          width: SLOT_WIDTH,
          height: SLOT_HEIGHT,
        }}
        onClick={uiClick(() => {
          if (listOpen) closeList();
          else {
            setAssignSlot(-1);
            setListOpen(true);
          }
        })}
        onContextMenu={e => {
          e.preventDefault();
          uiClick(() => Store.selectSkill(-1))();
        }}
        onPointerEnter={() => dragging && setDropSlot(DROP_CURRENT)}
        onPointerLeave={() => leaveDrop(DROP_CURRENT)}
      >
        {Store.currentSkill >= 0 && icon(Store.currentSkill, !skills.requirementsMet(Store.currentSkill))}
        <div className="skill-current-mark" aria-hidden>
          ▲
        </div>
      </div>
      {listOpen &&
        fanSkills.map((number, count) => {
          const { left, top } = fanPosition(count);
          const usable = skills.requirementsMet(number);
          const key = hotkeyOf(number);
          const selected = number === Store.currentSkill;
          const classes = ['skill-slot', 'fan'];
          if (selected) classes.push('selected');
          if (!usable) classes.push('unusable');
          return (
            <div
              key={number}
              className={classes.join(' ')}
              style={{ left, top, width: SLOT_WIDTH, height: SLOT_HEIGHT }}
              {...boxEvents(number, true)}
            >
              {icon(number, !usable)}
              {key && <div className="skill-hotkey">{key}</div>}
            </div>
          );
        })}
      {listOpen && assignSlot >= 0 && (
        <div
          className="skill-slot fan clear"
          title={t('bottomBar.clearSlot', { key: assignSlot })}
          style={{
            ...fanPosition(fanSkills.length),
            width: SLOT_WIDTH,
            height: SLOT_HEIGHT,
          }}
          onClick={uiClick(() => {
            Store.assignSkillHotkey(assignSlot, -1);
            closeList();
          })}
        >
          <span>&times;</span>
        </div>
      )}
      {dragging && drag && <SkillDragGhost drag={drag} />}
      {tip && !dragging && (
        <SkillTooltip
          number={tip.number}
          level={skillList.find(s => s.number === tip.number)?.level ?? 0}
          x={tip.x}
          y={tip.y}
        />
      )}
    </>
  );
});

export const BottomBar = observer(() => {
  const scale = MuWindows.scaleOf(BAR_ID);

  // `CMuHelper::Toggle`: the Start / Stop button of the position panel, on its key.
  useEventBus('keyPressed', code => {
    if (isKey('muHelper', code) && Store.world?.playerEntity) Store.toggleMuHelper();
  });

  return (
    <div
      className="bottom-bar"
      style={{
        width: BAR_WIDTH,
        height: BAR_HEIGHT,
        transform: `translateX(-50%) scale(${scale})`,
        transformOrigin: '50% 100%',
      }}
    >
      {!COMPACT && <HuntPanel left={0} width={HUNT_WIDTH} height={BAR_HEIGHT} />}

      <div className="hud-panel skills-panel" style={{ left: CENTER_X, top: 0, width: CENTER_WIDTH, height: BAR_HEIGHT }}>
        <div className="skills-panel-title">
          <span aria-hidden>⚔</span> {mt('hud.skills')}
        </div>
      </div>
      <SkillSlots />
      <ConsumableItems />
      <ExpBar />
      <PetCommandBar
        left={CENTER_X + CENTER_WIDTH - PET_COMMAND_BAR_WIDTH - 10}
        top={-PET_COMMAND_BAR_HEIGHT - 8}
      />

      {!COMPACT && <StatsPanel left={STATS_X} width={STATS_WIDTH} height={BAR_HEIGHT} />}

      {MAIN_FRAME_BUTTONS.map((button, index) => (
        <BarButton
          key={button.file}
          index={index}
          file={button.file}
          title={t(button.titleKey)}
          onClick={button.toggle}
        />
      ))}

      <MuResizeGrip id={BAR_ID} width={BAR_WIDTH} />
    </div>
  );
});
