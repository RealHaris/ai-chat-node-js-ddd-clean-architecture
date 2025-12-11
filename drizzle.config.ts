import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/shared/infra/db/schemas/*.ts",
  out: "./src/shared/infra/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/ai_chat_db",
  },
  verbose: true,
  strict: true,
});
