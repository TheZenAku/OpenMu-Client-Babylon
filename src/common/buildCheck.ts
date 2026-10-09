import { makeAutoObservable, runInAction } from 'mobx';
import { EventBus } from '../libs/eventBus';

/**
 * Updates as the player sees them (D34), behind the update window (`UpdateNotice`):
 *
 * - a newer client build than the one this page runs. The page is revalidated on every load (no-cache)
 *   and the code files are hashed, so a reload always gets the new build - but an open tab never
 *   reloads by itself: it reconnects after a sleep or a dropped network and keeps showing the old
 *   interface (seen 10-08). Checked every minute, when the tab comes back into view, and at once when
 *   the server says a build went up (`onNotice`);
 * - a server restart the update tool announced (`onNotice`), counted down;
 * - that restart under way: the connection dropped at the announced time, and the page is asked for
 *   until the server answers again - then the reload brings the player back.
 *
 * The dev server (no hashed entry) never reports a new build.
 */

const ENTRY = /assets\/index-[A-Za-z0-9_-]+\.js/;
const CHECK_MS = 60_000;
/** While the server restarts: how often the page is asked for. */
const SERVER_POLL_MS = 4_000;
/** "Later" on a new build: the window comes back after this. */
const SNOOZE_MS = 10 * 60_000;
/** A connection lost this long before the announced restart (or any time after it) is that restart. */
const RESTART_SLACK_MS = 90_000;

function runningEntry(): string | null {
  for (const script of Array.from(document.querySelectorAll<HTMLScriptElement>('script[type="module"][src]'))) {
    const match = ENTRY.exec(script.src);
    if (match) return match[0];
  }
  return null;
}

/** A notice of the update tool, as the game server passes it on (MUIdle 0x07). */
export type UpdateNoticeData = { id?: string; kind?: string; seconds?: number };

/** What the update window shows. */
export type UpdateView = 'back' | 'updating' | 'restart' | 'stale' | null;

export const BuildCheck = new (class _BuildCheck {
  /** The server has a newer client than this page runs. */
  stale = false;
  /** When the server restarts (this page's clock); null without a restart announced. */
  restartAt: number | null = null;
  /** The countdown was acknowledged ("OK"); the window comes back when the server goes down. */
  restartAcknowledged = false;
  /** The server went down for the announced restart and has not answered since. */
  updating = false;
  /** The server answered again after the restart: the reload brings the new version. */
  back = false;
  /** "Later" on a new build, until then. */
  snoozedUntil = 0;
  /** The clock the countdown and the snooze read; ticks while either needs it. */
  now = Date.now();

  private started = false;
  private running: string | null = null;
  private ticker: number | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  start(): void {
    if (this.started || typeof document === 'undefined') return;
    this.started = true;
    this.running = runningEntry();
    EventBus.on('wsClosed', () => this.onConnectionLost());
    if (!this.running) return;

    window.setInterval(() => void this.checkNow(), CHECK_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void this.checkNow();
    });
  }

  /** Asks the server for the page: a newer build marks the tab stale. Whether the server answered. */
  async checkNow(): Promise<boolean> {
    try {
      const response = await fetch(location.pathname + location.search, { cache: 'no-store' });
      if (!response.ok) return false;
      const served = ENTRY.exec(await response.text())?.[0];
      if (served && this.running && served !== this.running) runInAction(() => (this.stale = true));
      return true;
    } catch {
      // Offline or the server restarting.
      return false;
    }
  }

  /** A notice of the update tool: a new build is up, or the server restarts in `seconds`. */
  onNotice(notice: UpdateNoticeData): void {
    if (notice.kind === 'client') {
      void this.checkNow();
      return;
    }
    if (notice.kind === 'restart' && typeof notice.seconds === 'number' && notice.seconds >= 0) {
      this.restartAt = Date.now() + notice.seconds * 1000;
      this.restartAcknowledged = false;
      this.startTicking();
    }
  }

  /** Seconds to the announced restart. */
  get secondsLeft(): number {
    return this.restartAt === null ? 0 : Math.max(0, Math.ceil((this.restartAt - this.now) / 1000));
  }

  get view(): UpdateView {
    if (this.back) return 'back';
    if (this.updating) return 'updating';
    if (this.restartAt !== null && !this.restartAcknowledged) return 'restart';
    if (this.stale && this.now >= this.snoozedUntil) return 'stale';
    return null;
  }

  acknowledgeRestart(): void {
    this.restartAcknowledged = true;
  }

  /** "Later": the window goes and comes back in ten minutes. */
  snooze(): void {
    this.snoozedUntil = Date.now() + SNOOZE_MS;
    this.now = Date.now();
    this.startTicking();
  }

  /** The connection dropped: at an announced restart, wait for the server to answer again. */
  private onConnectionLost(): void {
    if (this.restartAt === null || this.updating || this.back) return;
    // Any other drop is the session resume's business.
    if (Date.now() < this.restartAt - RESTART_SLACK_MS) return;

    this.updating = true;
    const poll = async () => {
      if (await this.checkNow()) {
        runInAction(() => {
          this.updating = false;
          this.back = true;
        });
        return;
      }
      window.setTimeout(() => void poll(), SERVER_POLL_MS);
    };
    window.setTimeout(() => void poll(), SERVER_POLL_MS);
  }

  /** The clock runs once a second while a countdown or a snooze needs it. */
  private startTicking(): void {
    if (this.ticker !== null) return;
    this.ticker = window.setInterval(() => {
      runInAction(() => (this.now = Date.now()));
      const counting = this.restartAt !== null && this.now < this.restartAt;
      const snoozed = this.now < this.snoozedUntil;
      if (!counting && !snoozed && this.ticker !== null) {
        window.clearInterval(this.ticker);
        this.ticker = null;
      }
    }, 1000);
  }
})();
