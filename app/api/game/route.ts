/**
 * Next.js route for local development (`npm run dev`).
 *
 * Production traffic is served by the standalone Worker in `worker/api.ts`.
 * Both share the implementation in `lib/game-api.ts`.
 */
import { handleGet, handleOptions, handlePost } from "../../../lib/game-api.ts";

export async function GET(request: Request) { return handleGet(request); }

export async function POST(request: Request) { return handlePost(request); }

export function OPTIONS(request: Request) { return handleOptions(request); }
