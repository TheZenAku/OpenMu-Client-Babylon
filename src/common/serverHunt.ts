/**
 * HUNT v2 (docs/HUNT_V2.md): while HUNT is on, the server hunts for the character - it walks, swings
 * and casts for it, and the client only shows that. The hero's own walks and swings then come from the
 * server (ObjectWalked / ObjectAnimation), which the client drops as echoes of its own actions in
 * manual play.
 *
 * The player may still take the controls: every walk, attack, skill or pickup the client sends while
 * HUNT is on is the player's own (the client does no hunting), and the server holds the hunt still for a
 * moment (`OnlineHunt.ManualControlPause`). Meanwhile the hero is the client's again.
 */

/** As long as the server holds the hunt after the player's own action (OnlineHunt.ManualControlPause). */
const MANUAL_CONTROL_MS = 15_000;
/** The server hears of the player's actions at most this often. */
const NOTICE_INTERVAL_MS = 2_000;

export const ServerHunt = {
  /** HUNT is on: the server hunts for the character. */
  active: false,
  /** Until then the player has the controls (its own action); the server holds the hunt. */
  manualUntil: 0,
  /** Tells the server of the player's own action (set by the MUIdle state, which owns the socket). */
  notifyServer: null as (() => void) | null,
  lastNotice: 0,
};

/** The server drives the hero now: HUNT is on and the player has not taken the controls lately. */
export function serverDrivesHero(): boolean {
  return ServerHunt.active && performance.now() >= ServerHunt.manualUntil;
}

/** The player walked, attacked, cast or picked something up: while HUNT is on, the hunt holds still. */
export function noteManualControl(): void {
  if (!ServerHunt.active) return;
  const now = performance.now();
  ServerHunt.manualUntil = now + MANUAL_CONTROL_MS;
  if (now - ServerHunt.lastNotice < NOTICE_INTERVAL_MS) return;
  ServerHunt.lastNotice = now;
  ServerHunt.notifyServer?.();
}
