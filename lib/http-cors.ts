/**
 * CORS policy for the game API.
 *
 * The API and the player interface are deployed to different origins: the
 * interface is served by GitHub Pages, the API runs as a Cloudflare Worker on
 * your own account. Allowed origins are therefore configuration, not a
 * constant — set ALLOWED_ORIGINS on the Worker (see wrangler.jsonc).
 */

/** Used when the deployment sets no ALLOWED_ORIGINS value. */
export const DEFAULT_ALLOWED_ORIGINS = ['https://awaisshahist110-lab.github.io'];

let allowList: string[] = [...DEFAULT_ALLOWED_ORIGINS];

/** Strips trailing slashes and casing differences so comparisons are exact. */
function normalize(origin: string) {
  return origin.trim().replace(/\/+$/, '').toLowerCase();
}

/**
 * Replaces the allow list. Accepts the comma-separated form used by Worker
 * environment variables, or an explicit array. Empty input restores the
 * default so a missing variable can never open the API to every origin.
 */
export function setAllowedOrigins(origins: string | string[] | undefined | null) {
  const list = (typeof origins === 'string' ? origins.split(',') : origins ?? [])
    .map(normalize)
    .filter(Boolean);
  allowList = list.length ? list : [...DEFAULT_ALLOWED_ORIGINS];
}

export function getAllowedOrigins() {
  return [...allowList];
}

export function allowedOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  const requestOrigin = normalize(origin);
  return requestOrigin === normalize(new URL(request.url).origin) || allowList.includes(requestOrigin);
}

export function withGameCors(request: Request, response: Response) {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store');
  headers.set('Vary', 'Origin, Authorization');
  const origin = request.headers.get('origin');
  if (origin && allowedOrigin(request)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    headers.set('Access-Control-Max-Age', '600');
  }
  return new Response(response.body, { status: response.status, headers });
}

export function preflight(request: Request) {
  return withGameCors(request, new Response(null, { status: allowedOrigin(request) ? 204 : 403 }));
}
