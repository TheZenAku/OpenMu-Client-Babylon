export const MAX_USERNAME_LENGTH = 10;
export const MAX_PASSWORD_LENGTH = 10;

// Connect-server and ws-proxy endpoints - the DEFAULTS only. They seed the
// first server profile on a fresh install; from then on `common/serverConfig.ts`
// owns where the client connects (saved profiles, edited in the start screen's
// server picker, with `?cs=` / `?ws=` in the URL above them). A build sets its
// own defaults with `VITE_CS_HOST`, `VITE_CS_PORT`, `VITE_WS_HOST` (scheme
// included, e.g. `wss://play.example.com`) and `VITE_WS_PORT`.
const env = import.meta.env;

export const CS_HOST = env.VITE_CS_HOST || '127.0.0.1';
export const CS_PORT = Number(env.VITE_CS_PORT) || 44405;

/**
 * `VITE_WS_HOST=auto`: the proxy runs on the machine that serves the page, so
 * its host is whatever the browser used to reach us (localhost, a LAN IP, a
 * name) - one build works for every player on the network.
 */
export const WS_SAME_HOST = env.VITE_WS_HOST === 'auto';

function pageWsHost(): string {
  if (typeof location === 'undefined' || !location.hostname) return 'ws://localhost';

  const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
  const host = location.hostname.includes(':') ? `[${location.hostname}]` : location.hostname;

  return `${scheme}://${host}`;
}

export const WS_HOST = WS_SAME_HOST ? pageWsHost() : env.VITE_WS_HOST || 'ws://localhost';
export const WS_PORT = Number(env.VITE_WS_PORT) || 3000;

/** Name of the seeded server profile (`VITE_SERVER_NAME`). */
export const SERVER_NAME = env.VITE_SERVER_NAME || 'Local (OpenMU)';

export const DISABLE_OBJECTS_LOADING = false;
export const DEBUG_PATHFINDING = false;
export const DEBUG_SHOW_TERRAIN_ATTRIBUTES = false;
export const DEBUG_SHOW_BOUNDING_BOXES = false;

export const ENABLE_BG_MUSIC = true;
