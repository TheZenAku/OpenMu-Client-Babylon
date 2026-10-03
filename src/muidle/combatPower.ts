import { Store } from '../store';
import { combatPowerParts as partsOf, type CombatPowerParts } from './combatPowerCore';

export { itemPower, weakestSlot, type CombatPowerInput, type CombatPowerParts } from './combatPowerCore';

/** The breakdown of the current character's Combat Power. */
export function combatPowerParts(): CombatPowerParts {
  return partsOf(Store.playerData);
}

/** The current character's Combat Power (formula in `combatPowerCore.ts` and docs/COMBAT_POWER.md). */
export function combatPower(): number {
  return partsOf(Store.playerData).total;
}
