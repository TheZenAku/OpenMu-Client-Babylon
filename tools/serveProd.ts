// Production web server for the built client (`bun run build` -> dist/).
//
//   bun run serve:prod
//
// Serves dist/ on WEB_HOST:WEB_PORT (default 0.0.0.0:45100) and forwards the
// same-origin API paths the dev server proxies in vite.config.ts:
//   /api/register/* -> 127.0.0.1:REGISTER_API_PORT
//   /api/ranking    -> 127.0.0.1:REGISTER_API_PORT (the public ranking board)
//   /api/market/*   -> 127.0.0.1:MARKETPLACE_API_PORT
// Both services listen on loopback only; the browser reaches them through here.
//
// The gzip sidecars (`*.gz`, tools/compressAssets.ts) are served as plain bytes:
// the client inflates them itself (common/compressedAssets.ts).

import { resolve, sep } from 'path';

const DEFAULT_ROOT = resolve(import.meta.dir, '..', process.env.WEB_ROOT ?? 'dist');
const ROOT_FILE = process.env.WEB_ROOT_FILE;
const HOST = process.env.WEB_HOST ?? '0.0.0.0';
const PORT = Number(process.env.WEB_PORT ?? 45100);
const REGISTER_PORT = Number(process.env.REGISTER_API_PORT ?? 3100);
const MARKET_PORT = Number(process.env.MARKETPLACE_API_PORT ?? 3300);
const MAX_API_BODY = 64 * 1024;

/**
 * MUIdle (D34): the build to serve may change under the running server. The update tool builds the next
 * client into another folder and names it in WEB_ROOT_FILE (first line; the build it replaces on the
 * second line): a page loaded from then on gets the new build, and a tab still on the old one keeps
 * finding its files (hashed code, game data) in the previous folder until it reloads. Without the file,
 * WEB_ROOT (dist) as before.
 */
let roots: string[] = [DEFAULT_ROOT];
let rootsStamp = 0;
let rootsCheckedAt = 0;

async function currentRoots(): Promise<string[]> {
  if (!ROOT_FILE) return roots;
  const now = Date.now();
  if (now - rootsCheckedAt < 1000) return roots;
  rootsCheckedAt = now;
  try {
    const file = Bun.file(ROOT_FILE);
    if (!(await file.exists())) {
      roots = [DEFAULT_ROOT];
      rootsStamp = 0;
      return roots;
    }
    if (file.lastModified === rootsStamp) return roots;
    const named = (await file.text())
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .slice(0, 2)
      .map(line => resolve(line));
    const usable: string[] = [];
    for (const dir of named) if (await Bun.file(`${dir}${sep}index.html`).exists()) usable.push(dir);
    // A pointer to nothing (a build half done, a typo) keeps what is served now.
    if (usable.length > 0) {
      if (usable[0] !== roots[0]) console.log(`[${new Date().toISOString()}] serve:prod - now serving ${usable[0]}`);
      roots = usable;
      rootsStamp = file.lastModified;
    }
  } catch {
    // Being written: the next request reads it again.
    rootsCheckedAt = 0;
  }
  return roots;
}

if (!(await Bun.file(`${(await currentRoots())[0]}${sep}index.html`).exists())) {
  console.error(`serve:prod - ${roots[0]}${sep}index.html is missing; run "bun run build" first.`);
  process.exit(1);
}

const API_ROUTES: [prefix: string, port: number][] = [
  ['/api/register', REGISTER_PORT],
  ['/api/ranking', REGISTER_PORT],
  ['/api/market', MARKET_PORT],
];

function securityHeaders(headers: Headers): Headers {
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'same-origin');
  headers.set('X-Frame-Options', 'SAMEORIGIN');
  return headers;
}

async function forward(req: Request, url: URL, port: number, clientIp: string): Promise<Response> {
  const length = Number(req.headers.get('content-length') ?? 0);
  if (length > MAX_API_BODY) return new Response('payload too large', { status: 413 });

  const headers = new Headers(req.headers);
  headers.delete('host');
  headers.set('x-forwarded-for', clientIp);
  headers.set('x-forwarded-host', url.host);
  try {
    const upstream = await fetch(`http://127.0.0.1:${port}${url.pathname}${url.search}`, {
      method: req.method,
      headers,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.arrayBuffer(),
      redirect: 'manual',
    });
    return new Response(upstream.body, { status: upstream.status, headers: securityHeaders(new Headers(upstream.headers)) });
  } catch {
    return new Response('service unavailable', { status: 502 });
  }
}

function cacheControl(path: string): string {
  if (path.endsWith('.html') || path === '/') return 'no-cache';
  if (path.startsWith('/assets/')) return 'public, max-age=31536000, immutable';
  return 'public, max-age=86400';
}

const server = Bun.serve({
  hostname: HOST,
  port: PORT,
  async fetch(req, srv) {
    const url = new URL(req.url);
    const clientIp = srv.requestIP(req)?.address ?? '';

    for (const [prefix, port] of API_ROUTES) {
      if (url.pathname === prefix || url.pathname.startsWith(`${prefix}/`)) {
        return forward(req, url, port, clientIp);
      }
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return new Response('method not allowed', { status: 405 });
    }

    let path: string;
    try {
      path = decodeURIComponent(url.pathname);
    } catch {
      return new Response('bad request', { status: 400 });
    }

    // The build served now first, then the one it replaced (a tab not reloaded yet asks for its files).
    const bases = await currentRoots();
    for (const base of bases) {
      const target = resolve(base, `.${path}`);
      if (target !== base && !target.startsWith(base + sep)) {
        return new Response('not found', { status: 404 });
      }

      const file = Bun.file(target);
      if (path !== '/' && (await file.exists())) {
        return new Response(file, {
          headers: securityHeaders(new Headers({ 'Cache-Control': cacheControl(path) })),
        });
      }
    }

    // Client-side routes (/online, /offline, ...) and the root get the app.
    const lastSegment = path.split('/').pop() ?? '';
    if (!lastSegment.includes('.')) {
      return new Response(Bun.file(`${bases[0]}${sep}index.html`), {
        headers: securityHeaders(new Headers({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' })),
      });
    }

    return new Response('not found', { status: 404 });
  },
  error(err) {
    console.error(`[${new Date().toISOString()}] serve:prod error:`, err.message);
    return new Response('internal error', { status: 500 });
  },
});

console.log(`serve:prod - ${roots[0]} on http://${server.hostname}:${server.port}`);
