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

  it('reads the gains of the run of kills as per-minute rates', () => {
    vi.setSystemTime(10_000);
    gain(600, 5);
    vi.setSystemTime(35_000);
    gain(300, 0); // a party share: experience, no kill
    vi.setSystemTime(60_000);
    gain(600, 6);

    // A minute since the run began at the first kill (not the session's start).
    vi.setSystemTime(70_000);
    SessionStats.tick();

    expect(SessionStats.experiencePerMinuteNow).toBeCloseTo(1_500);
    expect(SessionStats.killsPerMinuteNow).toBeCloseTo(2);
    // 6 000 experience to go at 1 500 a minute.
    expect(SessionStats.msToLevelNow).toBeCloseTo(240_000);
  });

  it('reads nothing once nothing has been killed for half a minute', () => {
    vi.setSystemTime(75_000);
    SessionStats.tick();
    expect(SessionStats.experiencePerMinuteNow).toBeGreaterThan(0);

    vi.setSystemTime(60_000 + 30_000);
    SessionStats.tick();

    // The gains are still inside the two minutes, but the character is idle.
    expect(SessionStats.recent.length).toBeGreaterThan(0);
    expect(SessionStats.experiencePerMinuteNow).toBe(0);
    expect(SessionStats.killsPerMinuteNow).toBe(0);
    expect(SessionStats.zenPerMinute).toBe(0);
    expect(SessionStats.msToLevelNow).toBeNull();
  });

  it('starts a new run at the next kill, read over at least fifteen seconds', () => {
    vi.setSystemTime(110_000);
    gain(600, 7);
    vi.setSystemTime(115_000);
    SessionStats.tick();

    // Only the new kill: the old run ended more than half a minute before it.
    expect(SessionStats.experiencePerMinuteNow).toBeCloseTo(2_400);
    expect(SessionStats.killsPerMinuteNow).toBeCloseTo(4);
  });

  it('ends the rates at once when HUNT stops', () => {
    SessionStats.pause();

    expect(SessionStats.experiencePerMinuteNow).toBe(0);
    expect(SessionStats.msToLevelNow).toBeNull();
  });

  it('lets the gains go once they are older than two minutes', () => {
    vi.setSystemTime(120_000);
    gain(100, 8);
    vi.setSystemTime(250_000);
    SessionStats.tick();

    expect(SessionStats.experiencePerMinuteNow).toBe(0);
    expect(SessionStats.killsPerMinuteNow).toBe(0);
    expect(SessionStats.recent).toHaveLength(0);
  });
});
