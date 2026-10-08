import { makeAutoObservable, runInAction } from 'mobx';

/**
 * Whether the server has a newer client build than the one this page runs. The page is
 * revalidated on every load (no-cache) and the code files are hashed, so a reload always gets the
 * new build - but an open tab never reloads by itself: it reconnects after a sleep or a dropped
 * network and keeps showing the old interface (seen 10-08: a tab from before a HUD deploy, back
 * after a reconnect, looked as if the deploy had not happened).
 *
 * Checks every few minutes and whenever the tab comes back into view; the dev server (no hashed
 * entry) never reports anything.
 */

const ENTRY = /assets\/index-[A-Za-z0-9_-]+\.js/;
const CHECK_MS = 3 * 60_000;

function runningEntry(): string | null {
  for (const script of Array.from(document.querySelectorAll<HTMLScriptElement>('script[type="module"][src]'))) {
    const match = ENTRY.exec(script.src);
    if (match) return match[0];
  }
  return null;
}

export const BuildCheck = new (class _BuildCheck {
  stale = false;

  private started = false;

  constructor() {
    makeAutoObservable(this);
  }

  start(): void {
    if (this.started || typeof document === 'undefined') return;
    this.started = true;
    const running = runningEntry();
    if (!running) return;

    const check = async () => {
      try {
        const response = await fetch(location.pathname + location.search, { cache: 'no-store' });
        if (!response.ok) return;
        const served = ENTRY.exec(await response.text())?.[0];
        if (served && served !== running) runInAction(() => (this.stale = true));
      } catch {
        // Offline or the server restarting: the next check will tell.
      }
    };

    window.setInterval(() => void check(), CHECK_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void check();
    });
  }
})();
