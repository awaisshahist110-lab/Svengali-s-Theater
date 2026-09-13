export interface RoomRecord {
  code: string;
  status: string;
  stateJson: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

declare global {
  var __civilizationRaidDb: D1Database | undefined;
}

export function setRoomsBinding(db: D1Database) {
  globalThis.__civilizationRaidDb = db;
}

function binding() {
  if (!globalThis.__civilizationRaidDb) throw new Error("Game storage is unavailable.");
  return globalThis.__civilizationRaidDb;
}

export function getRoomsBinding() {
  return binding();
}

export async function insertRoom(record: RoomRecord) {
  return binding()
    .prepare("INSERT INTO rooms (code, status, state_json, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(record.code, record.status, record.stateJson, record.version, record.createdAt, record.updatedAt)
    .run();
}

export async function loadRoom(code: string): Promise<RoomRecord | null> {
  const row = await binding()
    .prepare("SELECT code, status, state_json AS stateJson, version, created_at AS createdAt, updated_at AS updatedAt FROM rooms WHERE code = ?")
    .bind(code)
    .first<RoomRecord>();
  return row ?? null;
}

export async function saveRoom(code: string, expectedVersion: number, status: string, stateJson: string) {
  const updatedAt = new Date().toISOString();
  const result = await binding()
    .prepare("UPDATE rooms SET status = ?, state_json = ?, version = version + 1, updated_at = ? WHERE code = ? AND version = ?")
    .bind(status, stateJson, updatedAt, code, expectedVersion)
    .run();
  return result.meta.changes === 1;
}
