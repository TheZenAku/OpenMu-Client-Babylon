import { afterEach, describe, expect, it, vi } from 'vitest';

/** A page running `running`, a server answering with `served`; returns the check's verdict. */
async function verdict(running: string, served: string): Promise<boolean> {
  vi.resetModules();
  const listeners: Record<string, () => void> = {};
  vi.stubGlobal('document', {
    visibilityState: 'visible',
    querySelectorAll: () => [{ src: `http://host/assets/${running}` }],
    addEventListener: (type: string, listener: () => void) => (listeners[type] = listener),
  });
  vi.stubGlobal('window', { setInterval: () => 0 });
  vi.stubGlobal('location', { pathname: '/online', search: '' });
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, text: async () => `<script type="module" src="./assets/${served}"></script>` }))
  );

  const { BuildCheck } = await import('./buildCheck');
  BuildCheck.start();
  listeners.visibilitychange();
  await new Promise(resolve => setTimeout(resolve, 0));
  return BuildCheck.stale;
}

describe('BuildCheck (an open tab learns of a newer client)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports a server entry other than the running one', async () => {
    expect(await verdict('index-Old111.js', 'index-New222.js')).toBe(true);
  });

  it('stays quiet while the server serves the running build', async () => {
    expect(await verdict('index-Same333.js', 'index-Same333.js')).toBe(false);
  });
});

describe('BuildCheck and the update tool (D34)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  /** A page on build `running`, a server that answers `up()` with build `served`. */
  async function page(running: string, served: string, up: () => boolean) {
    vi.resetModules();
    vi.useFakeTimers();
    vi.stubGlobal('document', {
      visibilityState: 'visible',
      querySelectorAll: () => [{ src: `http://host/assets/${running}` }],
      addEventListener: () => {},
    });
    vi.stubGlobal('window', {
      setInterval: (fn: () => void, ms: number) => setInterval(fn, ms),
      clearInterval: (id: number) => clearInterval(id),
      setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
    });
    vi.stubGlobal('location', { pathname: '/online', search: '' });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        if (!up()) throw new Error('down');
        return { ok: true, text: async () => `<script type="module" src="./assets/${served}"></script>` };
      })
    );
    const { BuildCheck } = await import('./buildCheck');
    const { EventBus } = await import('../libs/eventBus');
    BuildCheck.start();
    return { BuildCheck, EventBus };
  }

  it('counts an announced restart down, and the OK puts the window away', async () => {
    const { BuildCheck } = await page('index-A.js', 'index-A.js', () => true);
    BuildCheck.onNotice({ id: '1', kind: 'restart', seconds: 120 });
    expect(BuildCheck.view).toBe('restart');
    vi.advanceTimersByTime(30_000);
    expect(BuildCheck.secondsLeft).toBe(90);
    BuildCheck.acknowledgeRestart();
    expect(BuildCheck.view).toBeNull();
  });

  it('waits out the restart and offers the reload once the server answers', async () => {
    let up = true;
    const { BuildCheck, EventBus } = await page('index-A.js', 'index-B.js', () => up);
    BuildCheck.onNotice({ id: '1', kind: 'restart', seconds: 10 });
    BuildCheck.acknowledgeRestart();
    vi.advanceTimersByTime(10_000);

    up = false;
    EventBus.emit('wsClosed', { socket: {} as WebSocket });
    expect(BuildCheck.view).toBe('updating');

    await vi.advanceTimersByTimeAsync(8_000);
    expect(BuildCheck.view).toBe('updating');

    up = true;
    await vi.advanceTimersByTimeAsync(4_000);
    expect(BuildCheck.view).toBe('back');
  });

  it('leaves a drop long before the restart to the session resume', async () => {
    const { BuildCheck, EventBus } = await page('index-A.js', 'index-A.js', () => true);
    BuildCheck.onNotice({ id: '1', kind: 'restart', seconds: 600 });
    BuildCheck.acknowledgeRestart();
    EventBus.emit('wsClosed', { socket: {} as WebSocket });
    expect(BuildCheck.view).toBeNull();
  });

  it('looks at once when a new build is announced, and "Later" brings it back in ten minutes', async () => {
    const { BuildCheck } = await page('index-A.js', 'index-B.js', () => true);
    BuildCheck.onNotice({ id: '2', kind: 'client' });
    await vi.advanceTimersByTimeAsync(0);
    expect(BuildCheck.view).toBe('stale');

    BuildCheck.snooze();
    expect(BuildCheck.view).toBeNull();
    await vi.advanceTimersByTimeAsync(10 * 60_000 + 1_000);
    expect(BuildCheck.view).toBe('stale');
  });
});
