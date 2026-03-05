import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Re-export all tables
export * from "./schema";

// Database client — call createDb() with DATABASE_URL
export function createDb(connectionString: string) {
  const client = postgres(connectionString, {
    ssl: "require",
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
  });
  return drizzle(client, { schema });
}

export type Db = ReturnType<typeof createDb>;
