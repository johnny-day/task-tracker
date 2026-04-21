import { prisma } from "@/lib/prisma";
import { loadSettings } from "@/lib/loadSettings";
import { calculateEstimate } from "@/lib/estimate";
import { rolloverRepeatingTasks } from "@/lib/rolloverRepeatingTasks";
import { sortTasksByCategoryThenOrder } from "@/lib/taskCategories";
import { todayInTimeZone } from "@/lib/todayInTimeZone";
import { NextRequest, NextResponse } from "next/server";
import { CalendarEvent } from "@/lib/types";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const calendarEvents: CalendarEvent[] = body.calendarEvents || [];

  await rolloverRepeatingTasks();

  const settings = await loadSettings();
  const today = todayInTimeZone(settings.fitnessTimeZone);

  const [tasksRaw, fitnessLog] = await Promise.all([
    prisma.task.findMany({
      where: { status: { not: "done" }, OR: [{ dueDate: today }, { dueDate: null }] },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.fitnessLog.findUnique({ where: { date: today } }),
  ]);

  const tasks = sortTasksByCategoryThenOrder(tasksRaw);

  const estimate = calculateEstimate(
    tasks,
    calendarEvents,
    fitnessLog?.activeCalories ?? 0,
    settings
  );

  return NextResponse.json(estimate);
}
