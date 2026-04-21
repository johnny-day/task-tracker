/**
 * Read-only: print task count and recent rows (use production DATABASE_URL from Vercel).
 *
 *   DATABASE_URL='postgresql://...' npx tsx scripts/list-tasks.ts
 */
import { PrismaClient } from "@prisma/client";

const url = process.env.DATABASE_URL ?? "";
if (!url.startsWith("postgres")) {
  console.error(
    "Set DATABASE_URL to a PostgreSQL URL (copy Production value from Vercel → Settings → Environment Variables)."
  );
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.task.count();
  console.log(`Total tasks: ${count}\n`);
  if (count === 0) {
    console.log("No rows in Task — DB is empty or wrong database/branch.");
    return;
  }
  const tasks = await prisma.task.findMany({
    orderBy: { updatedAt: "desc" },
    take: 300,
    select: {
      id: true,
      title: true,
      category: true,
      status: true,
      repeatDaily: true,
      updatedAt: true,
    },
  });
  console.log("status\tcategory\trepeat\ttitle\tid");
  for (const t of tasks) {
    const r = t.repeatDaily ? "daily" : "";
    console.log(
      `${t.status}\t${t.category}\t${r}\t${t.title.replace(/\t/g, " ")}\t${t.id}`
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
