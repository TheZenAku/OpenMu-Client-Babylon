import { makeAutoObservable, reaction, runInAction } from 'mobx';
import { EventBus } from '../libs/eventBus';
import { Store } from '../store';

/**
 * What this sitting has been worth: experience, kills and zen since the
 * counter was last reset, and the rates they imply.
 *
 * Everything here is derived from packets the client already handles -
 * `ExperienceGained` for the exp and the killing blow, the money field for
 * the zen - so it costs one event listener and one reaction. The clock only
 * runs while the tracker is on screen (`tick`), so a closed panel is idle.
 */

const MS_PER_HOUR = 3_600_000;
const MS_PER_MINUTE = 60_000;

/** The span the "now" rates look back over (the HUD's XP / min and kills / min). */
const RECENT_MS = 120_000;

export const SessionStats = new (class _SessionStats {
  /** Wall clock of the last reset. */
  startedAt = Date.now();
  /** Re-read once a second by the panel, so the elapsed line moves. */
  now = Date.now();

  experience = 0;
  kills = 0;
  zen = 0;

  /** The gains of the last `RECENT_MS`, for the rates "now". */
  recent: { at: number; experience: number; kill: boolean }[] = [];

  private money = 0;
  private watching = false;

  constructor() {
    makeAutoObservable(this);
  }

  get elapsedMs(): number {
    return Math.max(0, this.now - this.startedAt);
  }

  private perHour(total: number): number {
    const ms = this.elapsedMs;
    // Under a minute the rates swing wildly; the panel prints a dash.
    return ms < 60_000 ? 0 : (total * MS_PER_HOUR) / ms;
  }

  get experiencePerHour(): number {
    return this.perHour(this.experience);
  }

  get killsPerHour(): number {
    return this.perHour(this.kills);
  }

  get zenPerHour(): number {
    return this.perHour(this.zen);
  }

  /** Over the last two minutes (or the session, when it is younger): what is happening now. */
  private perMinuteNow(pick: (gain: { experience: number; kill: boolean }) => number): number {
    const span = Math.min(RECENT_MS, this.elapsedMs);
    if (span < 15_000) return 0;
    const since = this.now - span;
    let total = 0;
    for (const gain of this.recent) if (gain.at >= since) total += pick(gain);
    return (total * MS_PER_MINUTE) / span;
  }

  get experiencePerMinuteNow(): number {
    return this.perMinuteNow(gain => gain.experience);
  }

  get killsPerMinuteNow(): number {
    return this.perMinuteNow(gain => (gain.kill ? 1 : 0));
  }

  get zenPerMinute(): number {
    return this.zenPerHour / 60;
  }

  /** The next level at the rate now, else the session's; null when there is nothing to go on. */
  get msToLevelNow(): number | null {
    const now = this.experiencePerMinuteNow;
    if (now <= 0) return this.msToLevel;
    const { exp, expToNextLvl } = Store.playerData;
    const remaining = expToNextLvl - exp;
    return remaining > 0 ? (remaining / now) * MS_PER_MINUTE : null;
  }

  /**
   * Milliseconds to the next level at the running rate, or null when there
   * is nothing to go on yet (no rate, or the bar is already full).
   */
  get msToLevel(): number | null {
    const rate = this.experiencePerHour;
    if (rate <= 0) return null;

    const { exp, expToNextLvl } = Store.playerData;
    const remaining = expToNextLvl - exp;
    if (remaining <= 0) return null;

    return (remaining / rate) * MS_PER_HOUR;
  }

  reset(): void {
    runInAction(() => {
      this.startedAt = Date.now();
      this.now = this.startedAt;
      this.experience = 0;
      this.kills = 0;
      this.zen = 0;
      this.recent = [];
      this.money = Store.playerData.money;
    });
  }

  /** Called once a second while the panel (or the HUD's rates) is on screen. */
  tick(): void {
    runInAction(() => {
      this.now = Date.now();
      const since = this.now - RECENT_MS;
      if (this.recent.length && this.recent[0].at < since) {
        this.recent = this.recent.filter(gain => gain.at >= since);
      }
    });
  }

  /**
   * Start counting. Idempotent, and called from the panel rather than at
   * import time so a client that never opens it never listens.
   */
  watch(): void {
    if (this.watching) return;
    this.watching = true;
    this.money = Store.playerData.money;

    EventBus.on('experienceGained', ({ added, killedNetId }) => {
      runInAction(() => {
        this.experience += added;
        // The killing blow is the client's own (`quests/killCounters.ts`
        // reads the same field); a share from a party mate carries none.
        if (killedNetId) this.kills++;
        this.recent.push({ at: Date.now(), experience: added, kill: !!killedNetId });
      });
    });

    // Zen has no packet of its own - every source writes the same field -
    // so income is the rises of it. Spending is not counted: this is a
    // "what did the hunt bring in" line, not a balance sheet.
    reaction(
      () => Store.playerData.money,
      money => {
        const gained = money - this.money;
        this.money = money;
        if (gained > 0) runInAction(() => (this.zen += gained));
      }
    );

    // A different character is a different session.
    reaction(
      () => Store.playerData.name,
      () => this.reset()
    );
  }
})();
