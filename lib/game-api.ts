/**
 * The multiplayer game API, independent of how it is hosted.
 *
 * Both entry points delegate here: `worker/api.ts` (the standalone Cloudflare
 * Worker this project deploys) and `app/api/game/route.ts` (the Next.js route
 * used by `npm run dev`). Keeping the logic here means the hosted API and the
 * local one can never drift apart.
 *
 * Callers must bind storage with `setRoomsBinding` before the first request.
 */
import { insertRoom, loadRoom, saveRoom } from "../db/rooms.ts";
import { allowedOrigin, preflight, withGameCors } from "./http-cors.ts";
import type { GameAction, GameState } from "./theatre.ts";
import {
  applyAction,
  createLobby,
  GameError,
  joinLobby,
  playerFromToken,
  publicState,
  startMatch,
} from "./theatre.ts";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function roomCode() {
  let code = "";
  for (let index = 0; index < 6; index += 1) code += CODE_ALPHABET[crypto.getRandomValues(new Uint32Array(1))[0] % CODE_ALPHABET.length];
  return code;
}

function normalizeCode(value: unknown) {
  return String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

function normalizeName(value: unknown) {
  return String(value ?? "").trim().slice(0, 24);
}

async function mutateRoom<T>(code: string, mutation: (state: GameState) => T) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const row = await loadRoom(code);
    if (!row) throw new GameError("Room not found.", 404);
    const state = JSON.parse(row.stateJson) as GameState;
    const result = mutation(state);
    const saved = await saveRoom(code, row.version, state.status, JSON.stringify(state));
    if (saved) return { state, result, version: row.version + 1 };
  }
  throw new GameError("The room changed while your move was being processed. Try again.", 409);
}

async function getGame(request: Request) {
  try {
    const url = new URL(request.url);
    const code = normalizeCode(url.searchParams.get("code"));
    const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
    if (code.length !== 6) throw new GameError("Enter a valid six-character room code.");
    const row = await loadRoom(code);
    if (!row) throw new GameError("Room not found.", 404);
    const state = JSON.parse(row.stateJson) as GameState;
    if (!playerFromToken(state, token)) throw new GameError("Your seat could not be verified. Join the room again.", 403);
    return Response.json({ state: publicState(state, token), version: row.version }, { headers: { "Cache-Control": "no-store", Vary: "Authorization" } });
  } catch (error) {
    return errorResponse(error);
  }
}

async function postGame(request: Request) {
  try {
    if (!allowedOrigin(request)) throw new GameError("This request must come from the game.", 403);
    const payload = await request.json() as {
      op?: string;
      code?: string;
      token?: string;
      name?: string;
      action?: GameAction;
      requestId?: string;
    };

    if (payload.op === "create") {
      const name = normalizeName(payload.name);
      if (!name) throw new GameError("Enter a display name.");
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const code = roomCode();
        if (await loadRoom(code)) continue;
        const { state, token } = createLobby(code, name);
        const now = new Date().toISOString();
        await insertRoom({ code, status: state.status, stateJson: JSON.stringify(state), version: 1, createdAt: now, updatedAt: now });
        return Response.json({ code, token, state: publicState(state, token), version: 1 }, { status: 201 });
      }
      throw new GameError("Could not create a unique room. Try again.", 503);
    }

    const code = normalizeCode(payload.code);
    if (code.length !== 6) throw new GameError("Enter a valid six-character room code.");

    if (payload.op === "join") {
      const name = normalizeName(payload.name);
      const changed = await mutateRoom(code, (state) => joinLobby(state, name));
      return Response.json({ code, token: changed.result, state: publicState(changed.state, changed.result), version: changed.version });
    }

    if (payload.op === "start") {
      const token = String(payload.token ?? "");
      const changed = await mutateRoom(code, (state) => {
        const player = playerFromToken(state, token);
        if (!player) throw new GameError("Your seat could not be verified.", 403);
        startMatch(state, player.id);
      });
      return Response.json({ state: publicState(changed.state, token), version: changed.version });
    }

    if (payload.op === "action") {
      const token = String(payload.token ?? "");
      if (!payload.action) throw new GameError("Choose an action.");
      const changed = await mutateRoom(code, (state) => {
        const player = playerFromToken(state, token);
        if (!player) throw new GameError("Your seat could not be verified.", 403);
        if (payload.requestId && state.processed.includes(player.id + ":" + payload.requestId)) return;
        applyAction(state, player.id, payload.action as GameAction);
        if (payload.requestId) state.processed = [...state.processed, player.id + ":" + payload.requestId].slice(-100);
      });
      return Response.json({ state: publicState(changed.state, token), version: changed.version });
    }

    throw new GameError("Unknown game operation.");
  } catch (error) {
    return errorResponse(error);
  }
}

function errorResponse(error: unknown) {
  const status = error instanceof GameError ? error.status : 500;
  if (!(error instanceof GameError)) console.error("Game request failed", error);
  const message = error instanceof GameError ? error.message : "The Theatre could not save that move. Please try again.";
  return Response.json({ error: message }, { status });
}

export async function handleGet(request: Request) {
  if (!allowedOrigin(request)) return withGameCors(request, errorResponse(new GameError("This request must come from the game.", 403)));
  return withGameCors(request, await getGame(request));
}

export async function handlePost(request: Request) {
  return withGameCors(request, await postGame(request));
}

export function handleOptions(request: Request) {
  return preflight(request);
}

/** Routes one `/api/game` request by method. Used by the standalone Worker. */
export async function handleGameRequest(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") return handleOptions(request);
  if (request.method === "GET") return handleGet(request);
  if (request.method === "POST") return handlePost(request);
  return withGameCors(request, Response.json({ error: "Unsupported method." }, { status: 405 }));
}
