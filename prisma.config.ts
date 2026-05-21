import path from "node:path";
import { defineConfig } from "prisma/config";
import dotenv from "dotenv";

const root = process.cwd();
dotenv.config({ path: path.join(root, ".env.local") });
dotenv.config({ path: path.join(root, ".env") });

// Placeholder only for `prisma generate` on CI/Vercel when DATABASE_URL is not injected yet.
const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://build:build@127.0.0.1:5432/build?schema=public";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: databaseUrl,
  },
});

