import { Store } from '../store';
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

export function combatPower(): number {
  const p = Store.playerData;
  let power = p.level * 10 + p.masterLevel * 15;
  power += (p.str + p.agi + p.sta + p.eng + p.leadership) * 2;
  power += p.maxHP * 0.5 + p.maxMP * 0.2 + p.maxSD * 0.3;
  for (let slot = 0; slot < EQUIPPED_SLOTS; slot++) {
    const item = p.items[slot];
    if (item) power += itemPower(item, slot);
  }
  return Math.round(power);
}
