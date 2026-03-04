import type { Config } from "drizzle-kit";

export default {
  schema: "./packages/shared/src/db/schema.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;
