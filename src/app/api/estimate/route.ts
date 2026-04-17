import { prisma } from "@/lib/prisma";
import { calculateEstimate } from "@/lib/estimate";
import { NextRequest, NextResponse } from "next/server";
import { CalendarEvent, Settings } from "@/lib/types";

function todayInTimeZone(tz: string | null | undefined): string {
  if (tz) {
    try {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
    } catch {
      /* fall through to UTC */
    }
  }
  return new Date().toISOString().slice(0, 10);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const calendarEvents: CalendarEvent[] = body.calendarEvents || [];

  const settings = await prisma.settings.findUnique({ where: { id: "default" } });

  const today = todayInTimeZone(settings?.fitnessTimeZone);

  const [tasks, fitnessLog] = await Promise.all([
    prisma.task.findMany({
      where: { status: { not: "done" }, OR: [{ dueDate: today }, { dueDate: null }] },
      orderBy: [{ priority: "asc" }, { sortOrder: "asc" }],
    }),
    prisma.fitnessLog.findUnique({ where: { date: today } }),
  ]);

  const effectiveSettings: Settings =
    settings != null
      ? {
          id: settings.id,
          wakeTime: settings.wakeTime,
          sleepTime: settings.sleepTime,
          calorieGoal: settings.calorieGoal,
          calBurnRate: settings.calBurnRate,
          burnRateOnboardingDone: settings.burnRateOnboardingDone,
          fitnessTimeZone: settings.fitnessTimeZone ?? null,
        }
      : {
          id: "default",
          wakeTime: "07:00",
          sleepTime: "22:00",
          calorieGoal: 700,
          calBurnRate: 4.0,
          burnRateOnboardingDone: true,
          fitnessTimeZone: null,
        };

  const estimate = calculateEstimate(
    tasks,
    calendarEvents,
    fitnessLog?.activeCalories ?? 0,
    effectiveSettings
  );

  return NextResponse.json(estimate);
}
