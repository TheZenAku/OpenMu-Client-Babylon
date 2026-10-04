import type { IdleSettings } from './state';

/**
 * The hunt's map choice and activity, as plain data: no store, so it can be
 * tested on its own. The server decides both; this only names them.
 */

/** What the hunt is doing right now, as the server tracks it (online and offline alike). */
export type HuntActivityKind = 'idle' | 'hunting' | 'travelling' | 'warping' | 'shopping' | 'buff' | 'dead' | 'event' | 'quest' | 'paused';
export type HuntActivity = {
  kind: HuntActivityKind;
  map: string | null;
  /** Why the pinned map is not where the hunt is (`level`, `zen`, `noWarp`, `requirement`), if so. */
  pinnedReason: HuntMapReason | null;
  /** Why HUNT is paused (`zen`: the MU Helper fee), with the player's Zen and the fee. */
  pause?: { reason: 'zen'; have: number; need: number } | null;
  /** Why HUNT does not do what it would: no safer map, a fare it cannot pay, a quest waiting for zen. */
  notes?: HuntNote[];
};

/** A server note under the activity; `have`/`need` are Zen where the reason has amounts. */
export type HuntNote = { reason: 'noSafeMap' | 'noFare' | 'questZen'; have: number; need: number };

/** Why a map cannot be the hunting map right now. */
export type HuntMapReason = 'level' | 'zen' | 'noWarp' | 'requirement';

/** A map the hunt can be pinned to, as the server judged it for this character. */
export type HuntMapOption = {
  number: number;
  name: string;
  minLevel: number;
  fare: number;
  available: boolean;
  reason: HuntMapReason | null;
};

/**
 * Where the hunt goes: the best map for the level (auto), the map it is on (manual: never changes
 * maps), or one fixed map. Kept in the existing settings: `autoMapSelection` and `preferredMap`.
 */
export type HuntMapMode = 'auto' | 'manual' | number;

export function huntMapMode(settings: IdleSettings): HuntMapMode {
  if (settings.autoMapSelection) return 'auto';
  return settings.preferredMap ?? 'manual';
}

export function withHuntMapMode(settings: IdleSettings, mode: HuntMapMode): IdleSettings {
  if (mode === 'auto') return { ...settings, autoMapSelection: true, preferredMap: null };
  if (mode === 'manual') return { ...settings, autoMapSelection: false, preferredMap: null };
  return { ...settings, autoMapSelection: false, preferredMap: mode };
}
