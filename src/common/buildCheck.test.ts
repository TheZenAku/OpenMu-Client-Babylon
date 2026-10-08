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
