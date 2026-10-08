import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../store', () => ({
  Store: { playerData: { money: 0, name: 'Hero', exp: 1_000, expToNextLvl: 7_000 } },
}));

import { EventBus } from '../libs/eventBus';
import { SessionStats } from './sessionStats';

describe('SessionStats rates "now" (the HUD\'s XP / min and kills / min)', () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    SessionStats.watch();
    SessionStats.reset();
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  const gain = (added: number, killedNetId: number) =>
    EventBus.emit('experienceGained', { added, killedNetId } as never);

  it('reads the gains of the last two minutes as per-minute rates', () => {
    vi.setSystemTime(10_000);
    gain(600, 5);
    vi.setSystemTime(40_000);
    gain(600, 6);
    gain(300, 0); // a party share: experience, no kill

    vi.setSystemTime(60_000);
    SessionStats.tick();

    expect(SessionStats.experiencePerMinuteNow).toBeCloseTo(1_500);
    expect(SessionStats.killsPerMinuteNow).toBeCloseTo(2);
    // 6 000 experience to go at 1 500 a minute.
    expect(SessionStats.msToLevelNow).toBeCloseTo(240_000);
  });

  it('lets the gains go once they are older than two minutes', () => {
    vi.setSystemTime(200_000);
    SessionStats.tick();

    expect(SessionStats.experiencePerMinuteNow).toBe(0);
    expect(SessionStats.killsPerMinuteNow).toBe(0);
    expect(SessionStats.recent).toHaveLength(0);
  });
});
