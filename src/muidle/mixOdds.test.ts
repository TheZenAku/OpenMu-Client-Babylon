import { describe, expect, it } from 'vitest';
import { mixOddsView, parseMixPreview, traySignature } from './mixOdds';

describe('mix odds', () => {
  const ok = { mixType: 11, result: null, rate: 60, cost: 7000, fits: null };

  it('reads the server answer and refuses anything else', () => {
    expect(parseMixPreview(ok)).toEqual(ok);
    expect(parseMixPreview({ mixType: 1, result: 'LackingMixItems', rate: 0, cost: 0, fits: 4 })).toEqual({
      mixType: 1,
      result: 'LackingMixItems',
      rate: 0,
      cost: 0,
      fits: 4,
    });
    expect(parseMixPreview(null)).toBeNull();
    expect(parseMixPreview({ mixType: '11', rate: 60, cost: 1 })).toBeNull();
  });

  it('shows the odds of the picked recipe only', () => {
    expect(mixOddsView(ok, 11, [11])).toEqual({ kind: 'odds', rate: 60, cost: 7000 });
    expect(mixOddsView(ok, 7, [7, 11])).toBeNull();
    expect(mixOddsView(null, 11, [11])).toBeNull();
  });

  it('names a listed recipe the items fit, else the refusal', () => {
    const refused = { mixType: 1, result: 'IncorrectMixItems', rate: 0, cost: 0, fits: 11 };
    expect(mixOddsView(refused, 1, [1, 11])).toEqual({ kind: 'fits', mixType: 11 });
    expect(mixOddsView(refused, 1, [1])).toEqual({ kind: 'refused', result: 'IncorrectMixItems' });
    expect(mixOddsView({ ...refused, fits: null }, 1, [1, 11])).toEqual({
      kind: 'refused',
      result: 'IncorrectMixItems',
    });
  });

  it('changes with the tray, a growing stack included', () => {
    const one = traySignature([{ group: 14, num: 13, durability: 1 }, null]);
    expect(traySignature([{ group: 14, num: 13, durability: 2 }, null])).not.toBe(one);
    expect(traySignature([null, { group: 14, num: 13, durability: 1 }])).not.toBe(one);
    expect(traySignature([{ group: 14, num: 13, durability: 1 }, null])).toBe(one);
  });
});
