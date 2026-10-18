import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as s from "./schema";
export const gameDatabase = (url: string) => drizzle(neon(url), { schema: s });
export type GameDatabase = ReturnType<typeof gameDatabase>;
