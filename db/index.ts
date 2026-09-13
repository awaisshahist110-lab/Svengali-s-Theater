import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";
import { getRoomsBinding } from "./rooms";

export function getDb() {
  return drizzle(getRoomsBinding(), { schema });
}
