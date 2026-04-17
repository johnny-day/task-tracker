import { prisma } from "@/lib/prisma";
import { calculateEstimate } from "@/lib/estimate";
import { NextRequest, NextResponse } from "next/server";
import { CalendarEvent } from "@/lib/types";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const calendarEvents: CalendarEvent[] = body.calendarEvents || [];

  const today = new Date().toISOString().slice(0, 10);

  const [tasks, fitnessLog, settings] = await Promise.all([
    prisma.task.findMany({
      where: { status: { not: "done" }, OR: [{ dueDate: today }, { dueDate: null }] },
      orderBy: [{ priority: "asc" }, { sortOrder: "asc" }],
    }),
    prisma.fitnessLog.findUnique({ where: { date: today } }),
    prisma.settings.findUnique({ where: { id: "default" } }),
  ]);

  const effectiveSettings = settings || {
    id: "default",
    wakeTime: "07:00",
    sleepTime: "22:00",
    calorieGoal: 700,
    calBurnRate: 4.0,
    burnRateOnboardingDone: true,
  };

  const estimate = calculateEstimate(
    tasks,
    calendarEvents,
    fitnessLog?.activeCalories ?? 0,
    effectiveSettings
  );

  return NextResponse.json(estimate);
}
