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

const ROOT = resolve(import.meta.dir, '..', process.env.WEB_ROOT ?? 'dist');
const HOST = process.env.WEB_HOST ?? '0.0.0.0';
const PORT = Number(process.env.WEB_PORT ?? 45100);
const REGISTER_PORT = Number(process.env.REGISTER_API_PORT ?? 3100);
const MARKET_PORT = Number(process.env.MARKETPLACE_API_PORT ?? 3300);
const MAX_API_BODY = 64 * 1024;

const INDEX = Bun.file(`${ROOT}${sep}index.html`);
if (!(await INDEX.exists())) {
  console.error(`serve:prod - ${ROOT}${sep}index.html is missing; run "bun run build" first.`);
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

    const target = resolve(ROOT, `.${path}`);
    if (target !== ROOT && !target.startsWith(ROOT + sep)) {
      return new Response('not found', { status: 404 });
    }

    const file = Bun.file(target);
    if (path !== '/' && (await file.exists())) {
      return new Response(file, {
        headers: securityHeaders(new Headers({ 'Cache-Control': cacheControl(path) })),
      });
    }

    // Client-side routes (/online, /offline, ...) and the root get the app.
    const lastSegment = path.split('/').pop() ?? '';
    if (!lastSegment.includes('.')) {
      return new Response(INDEX, {
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

console.log(`serve:prod - ${ROOT} on http://${server.hostname}:${server.port}`);
