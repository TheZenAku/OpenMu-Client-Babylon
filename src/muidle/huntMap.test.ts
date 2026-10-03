import { describe, expect, it } from 'vitest';
import { huntMapMode, withHuntMapMode } from './huntMap';
import type { IdleSettings } from './state';

const base: IdleSettings = {
  autoTravel: true,
  autoMapSelection: true,
  preferredMap: null,
  autoSell: true,
  autoRepair: true,
  autoBuyPotions: true,
  keepHuntingAfterDeath: true,
  autoBuild: false,
  sellMaxItemLevel: 4,
  lockedItems: [],
  eventsFirst: true,
  eventOptOut: [],
  bossesFirst: true,
  questItemsFirst: true,
  buildPreset: null,
};

describe('the hunting map setting', () => {
  it('is automatic by default', () => {
    expect(huntMapMode(base)).toBe('auto');
  });

  it('round-trips auto, manual and a fixed map through the stored settings', () => {
    for (const mode of ['auto', 'manual', 3] as const) {
      expect(huntMapMode(withHuntMapMode(base, mode))).toBe(mode);
    }
  });

  it('stores a fixed map as no automatic selection plus the preferred map', () => {
    expect(withHuntMapMode(base, 7)).toMatchObject({ autoMapSelection: false, preferredMap: 7 });
    expect(withHuntMapMode(base, 'manual')).toMatchObject({ autoMapSelection: false, preferredMap: null });
  });

  it('leaves auto travel to its own switch', () => {
    const walking = { ...base, autoTravel: false };
    expect(withHuntMapMode(walking, 3).autoTravel).toBe(false);
    expect(huntMapMode({ ...walking, autoMapSelection: false, preferredMap: 3 })).toBe(3);
  });
});
