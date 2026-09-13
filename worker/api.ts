/**
 * Standalone Cloudflare Worker serving the multiplayer game API.
 *
 * This is the deployable API: it depends only on Wrangler and a D1 database,
 * with no Next.js, Vite or hosting-platform tooling involved. Deploy it to
 * your own Cloudflare account with `npm run deploy:api`.
 *
 * Bindings (see wrangler.jsonc):
 *   DB              - D1 database holding the `rooms` table.
 *   ALLOWED_ORIGINS - comma-separated origins permitted to call the API.
 */
import { setRoomsBinding } from "../db/rooms.ts";
import { setAllowedOrigins } from "../lib/http-cors.ts";
import { handleGameRequest } from "../lib/game-api.ts";

export interface ApiEnv {
  DB: D1Database;
  ALLOWED_ORIGINS?: string;
}

const worker = {
  async fetch(request: Request, env: ApiEnv): Promise<Response> {
    if (!env.DB) {
      return Response.json(
        { error: "Game storage is not configured. Check the DB binding in wrangler.jsonc." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    setRoomsBinding(env.DB);
    setAllowedOrigins(env.ALLOWED_ORIGINS);

    const { pathname } = new URL(request.url);

    if (pathname === "/api/game") return handleGameRequest(request);

    // Plain readiness probe, handy right after deploying.
    if (pathname === "/" || pathname === "/health") {
      return Response.json(
        { service: "svengalis-theatre-api", status: "ok" },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    return Response.json({ error: "Not found." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  },
};

export default worker;
