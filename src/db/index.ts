import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var __foodlinkPgClient: postgres.Sql | undefined;
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Add it to your .env.local (see .env.example).",
  );
}

// Reuse the connection across hot reloads in development to avoid
// exhausting the Postgres connection pool.
const client =
  global.__foodlinkPgClient ??
  postgres(process.env.DATABASE_URL, {
    max: process.env.NODE_ENV === "production" ? 10 : 1,
    idle_timeout: 20,
    connect_timeout: 10,
  });

if (process.env.NODE_ENV !== "production") {
  global.__foodlinkPgClient = client;
}

export const db = drizzle(client, { schema });
export type Database = typeof db;
