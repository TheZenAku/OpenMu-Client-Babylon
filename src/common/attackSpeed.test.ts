import { describe, expect, it } from 'vitest';
import { attackSpeedOf, magicSpeedOf, MAX_ATTACK_SPEED } from './characterStats';
import { CharacterClassNumber } from './types';

/**
 * Both speeds stop at the server's ceiling (OpenMU's Stats.AttackSpeed / MagicSpeed, 200): a character
 * with a lot of agility swung as fast as its agility said, far past what the server counts - the
 * speed-hack ban of 10-08 and the stutter of 10-14.
 */
describe('attack and magic speed', () => {
  it('follow agility below the ceiling', () => {
    expect(attackSpeedOf(CharacterClassNumber.DarkLord, 1500)).toBe(150);
  });

  it('stop at the server ceiling', () => {
    expect(attackSpeedOf(CharacterClassNumber.DarkLord, 14191)).toBe(MAX_ATTACK_SPEED);
    expect(magicSpeedOf(CharacterClassNumber.DarkLord, 14191)).toBe(MAX_ATTACK_SPEED);
    expect(MAX_ATTACK_SPEED).toBe(200);
  });
});
