/**
 * Run `prisma migrate deploy` on Vercel when DATABASE_URL is Postgres.
 * Skips locally (e.g. sqlite placeholder) so `npm run build` still works.
 */
import { execFileSync } from "child_process";

const vercel = process.env.VERCEL === "1";
const url = process.env.DATABASE_URL ?? "";
const isPostgres =
  url.startsWith("postgresql://") || url.startsWith("postgres://");

if (vercel && isPostgres) {
  console.log("[build] Running prisma migrate deploy…");
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    stdio: "inherit",
    env: process.env,
  });
} else {
  console.log(
    "[build] Skipping prisma migrate deploy (not Vercel or DATABASE_URL is not Postgres)."
  );
}
