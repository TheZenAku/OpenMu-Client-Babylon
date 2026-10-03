import { describe, expect, test } from 'bun:test';
import { classNumberOf, rank } from './ranking';

const rows = [
  { name: 'Ana', classNumber: 4, level: 400, resets: 3, masterLevel: 0 },
  { name: 'Bob', classNumber: 8, level: 300, resets: 3, masterLevel: 0 },
  { name: 'Cid', classNumber: 6, level: 250, resets: 1, masterLevel: 0 },
];

describe('ranking', () => {
  test('reads the class number from an OpenMU class id', () => {
    expect(classNumberOf('00000040-0004-0000-0000-000000000000')).toBe(4);
    expect(classNumberOf('00000040-0010-0000-0000-000000000000')).toBe(16);
    expect(classNumberOf('not-a-class')).toBe(-1);
  });

  test('ranks in the given order and filters by class line', () => {
    expect(rank(rows).map(r => [r.rank, r.name])).toEqual([[1, 'Ana'], [2, 'Bob'], [3, 'Cid']]);
    expect(rank(rows, 'knight').map(r => [r.rank, r.name])).toEqual([[1, 'Ana'], [2, 'Cid']]);
    expect(rank(rows, 'elf')).toHaveLength(1);
  });
});
