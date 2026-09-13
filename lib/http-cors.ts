const GITHUB_PAGES_ORIGIN = 'https://awaisshahist110-lab.github.io';

export function allowedOrigin(request: Request) {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin || origin === GITHUB_PAGES_ORIGIN;
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
