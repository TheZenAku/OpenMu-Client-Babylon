import type { Item } from '../ecs/world';

/**
 * Combat Power: a single number for the HUD, computed from values the server
 * sent (level, stats, life, mana and the equipped items). It is an indicator
 * only - nothing in combat reads it. The formula is documented in
 * `C:\MUIdle\docs\COMBAT_POWER.md`; keep the two in step.
 */

/** Equipped slots: 0..11 (weapons, armor, wings, pet, jewelry). */
const EQUIPPED_SLOTS = 12;
const WINGS_SLOT = 7;
const PET_SLOT = 8;

function countBits(value: number): number {
  let n = value;
  let count = 0;
  while (n) {
    count += n & 1;
    n >>= 1;
  }
  return count;
}

export function itemPower(item: Item, slot: number): number {
  let power = 40 + (item.lvl ?? 0) * 25;
  power += (item.optionLevel ?? 0) * 15;
  if (item.luck) power += 20;
  if (item.hasSkill) power += 10;
  if (item.isExcellent) power += 60 + countBits(item.excellentFlags ?? 0) * 60;
  if (item.isAncient) power += 150 + (item.ancientBonusLevel ?? 0) * 30;
  power += (item.socketCount ?? 0) * 40;
  if (slot === WINGS_SLOT) power += 300;
  if (slot === PET_SLOT) power += 100;
  return power;
}

/** What the CP is made of, for the breakdown. */
export type CombatPowerParts = {
  level: number;
  stats: number;
  vitals: number;
  /** One entry per equipment slot; `power` 0 and `item` null for an empty one. */
  slots: { slot: number; item: Item | null; power: number }[];
  total: number;
};

/** The values the CP is computed from (the server's numbers for the character). */
export type CombatPowerInput = {
  level: number;
  masterLevel: number;
  str: number;
  agi: number;
  sta: number;
  eng: number;
  leadership: number;
  maxHP: number;
  maxMP: number;
  maxSD: number;
  items: readonly (Item | null | undefined)[];
};

export function combatPowerParts(p: CombatPowerInput): CombatPowerParts {
  const level = p.level * 10 + p.masterLevel * 15;
  const stats = (p.str + p.agi + p.sta + p.eng + p.leadership) * 2;
  const vitals = p.maxHP * 0.5 + p.maxMP * 0.2 + p.maxSD * 0.3;
  const slots = Array.from({ length: EQUIPPED_SLOTS }, (_, slot) => {
    const item = p.items[slot] ?? null;
    return { slot, item, power: item ? itemPower(item, slot) : 0 };
  });
  const total = Math.round(level + stats + vitals + slots.reduce((sum, s) => sum + s.power, 0));
  return { level: Math.round(level), stats: Math.round(stats), vitals: Math.round(vitals), slots, total };
}

/**
 * Where the next CP is cheapest to find: the first empty slot, else the
 * equipped item worth the least. A hint, not a rule - some classes leave a
 * hand empty on purpose.
 */
export function weakestSlot(parts: CombatPowerParts): { slot: number; empty: boolean } | null {
  const empty = parts.slots.find(s => !s.item);
  if (empty) return { slot: empty.slot, empty: true };
  const weakest = parts.slots.reduce<(typeof parts.slots)[number] | null>((low, s) => (!low || s.power < low.power ? s : low), null);
  return weakest ? { slot: weakest.slot, empty: false } : null;
}

