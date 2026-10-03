import { describe, expect, it } from 'vitest';
import type { Item } from '../ecs/world';
import { combatPowerParts, weakestSlot, type CombatPowerInput } from './combatPowerCore';

const base: CombatPowerInput = {
  level: 100,
  masterLevel: 0,
  str: 100,
  agi: 50,
  sta: 50,
  eng: 0,
  leadership: 0,
  maxHP: 1000,
  maxMP: 500,
  maxSD: 0,
  items: [],
};

describe('combat power breakdown', () => {
  it('adds up level, stats, vitals and the equipped items', () => {
    const sword = { group: 0, num: 0, lvl: 2 } as Item;
    const parts = combatPowerParts({ ...base, items: [sword] });
    expect(parts.level).toBe(1000);
    expect(parts.stats).toBe(400);
    expect(parts.vitals).toBe(600);
    expect(parts.slots[0].power).toBe(90);
    expect(parts.total).toBe(1000 + 400 + 600 + 90);
  });

  it('points at an empty slot first, then at the weakest item', () => {
    const plain = { group: 0, num: 0 } as Item;
    const strong = { group: 0, num: 0, lvl: 9 } as Item;
    expect(weakestSlot(combatPowerParts({ ...base, items: [strong] }))).toEqual({ slot: 1, empty: true });
    const full = Array.from({ length: 12 }, (_, i) => (i === 5 ? plain : strong));
    expect(weakestSlot(combatPowerParts({ ...base, items: full }))).toEqual({ slot: 5, empty: false });
  });
});
