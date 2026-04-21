/**
 * On Vercel + Postgres: apply schema so production matches prisma/schema.prisma.
 *
 * 1) Prefer `prisma migrate deploy` (normal path).
 * 2) If that fails (e.g. P3005 non-empty DB without migration history — common
 *    after `db push` history), fall back to `prisma db push` for additive sync.
 *
 * Skips locally so `npm run build` works with non-Postgres .env placeholders.
 */
import { execFileSync } from "child_process";

const vercel = process.env.VERCEL === "1";
const url = process.env.DATABASE_URL ?? "";
const isPostgres =
  url.startsWith("postgresql://") || url.startsWith("postgres://");

if (vercel && isPostgres) {
  const env = {
    ...process.env,
    PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK: "1",
  };

  try {
    console.log("[build] Running prisma migrate deploy…");
    execFileSync("npx", ["prisma", "migrate", "deploy"], {
      stdio: "inherit",
      env,
    });
  } catch {
    console.warn(
      "[build] migrate deploy failed (e.g. P3005 baselining / empty migration history). Falling back to prisma db push…"
    );
    execFileSync("npx", ["prisma", "db", "push", "--skip-generate"], {
      stdio: "inherit",
      env,
    });
  }
} else {
  console.log(
    "[build] Skipping DB schema step (not Vercel or DATABASE_URL is not Postgres)."
  );
}
