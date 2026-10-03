import { describe, expect, it } from 'vitest';
import { AUTO, nextAutoState, presetValues, type AutoState } from './performance';

const start: AutoState = { level: 0, lowSince: null, highSince: null, changedAt: 0 };

/** Feeds one sample per second for `seconds` seconds. */
function run(state: AutoState, fps: number, from: number, seconds: number): AutoState {
  let s = state;
  for (let i = 0; i <= seconds; i++) s = nextAutoState(s, fps, from + i * 1000);
  return s;
}

describe('performance presets', () => {
  it('full is the shipped defaults, minimum turns the costly effects off', () => {
    const defaults = (key: string) => (key === 'shadows' ? true : key === 'renderScale' ? 0 : 5) as never;
    expect(presetValues('full', defaults).shadows).toBe(true);
    expect(presetValues('full', defaults).renderScale).toBe(0);
    const minimum = presetValues('minimum', defaults);
    expect(minimum.shadows).toBe(false);
    expect(minimum.postProcessing).toBe(false);
    expect(minimum.renderScale).toBe(4);
  });

  it('reduced never raises an option above the defaults', () => {
    const defaults = (key: string) => (key === 'renderScale' ? 0 : 1) as never;
    const reduced = presetValues('reduced', defaults);
    expect(reduced.bloom).toBe(1);
    expect(reduced.renderScale).toBe(2);
    expect(reduced.shadows).toBe(false);
  });
});

describe('automatic performance', () => {
  it('steps down after a while below the low threshold, not at the first bad frame', () => {
    const t0 = AUTO.cooldownMs;
    expect(nextAutoState(start, 10, t0).level).toBe(0);
    expect(run(start, 10, t0, AUTO.downAfterMs / 1000).level).toBe(1);
  });

  it('waits for the cooldown before stepping down again', () => {
    const t0 = AUTO.cooldownMs;
    const reduced = run(start, 10, t0, AUTO.downAfterMs / 1000);
    const soon = run(reduced, 10, t0 + AUTO.downAfterMs + 1000, 5);
    expect(soon.level).toBe(1);
    const later = run(soon, 10, t0 + AUTO.downAfterMs + AUTO.cooldownMs + 1000, AUTO.downAfterMs / 1000);
    expect(later.level).toBe(2);
  });

  it('steps up only after a long while above the high threshold', () => {
    const reduced: AutoState = { level: 1, lowSince: null, highSince: null, changedAt: 0 };
    const t0 = AUTO.cooldownMs;
    expect(run(reduced, 60, t0, 10).level).toBe(1);
    expect(run(reduced, 60, t0, AUTO.upAfterMs / 1000).level).toBe(0);
  });

  it('holds between the thresholds and resets its timers there', () => {
    const t0 = AUTO.cooldownMs;
    const almost = run(start, 10, t0, AUTO.downAfterMs / 1000 - 2);
    const middle = nextAutoState(almost, 35, t0 + AUTO.downAfterMs);
    expect(middle.lowSince).toBeNull();
    expect(nextAutoState(middle, 10, t0 + AUTO.downAfterMs + 1000).level).toBe(0);
  });
});
