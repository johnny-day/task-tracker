import { prisma } from "@/lib/prisma";
import { loadSettings } from "@/lib/loadSettings";
import { todayInTimeZone } from "@/lib/todayInTimeZone";

/** Idempotent: daily recurring tasks completed on a prior local day return to pending. */
export async function rolloverRepeatingTasks(): Promise<void> {
  const settings = await loadSettings();
  const today = todayInTimeZone(settings.fitnessTimeZone);
  await prisma.task.updateMany({
    where: {
      repeatDaily: true,
      status: "done",
      lastCompletedLocalDate: { not: null, lt: today },
    },
    data: {
      status: "pending",
      lastCompletedLocalDate: null,
    },
  });
}
