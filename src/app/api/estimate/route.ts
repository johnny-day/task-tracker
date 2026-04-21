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

  try {
    await rolloverRepeatingTasks();
  } catch (e) {
    console.error("[estimate POST] rolloverRepeatingTasks:", e);
    return NextResponse.json(
      {
        error: "Database setup failed (run migrations).",
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 500 }
    );
  }

  try {
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
  } catch (e) {
    console.error("[estimate POST]:", e);
    return NextResponse.json(
      {
        error: "Could not compute estimate.",
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 500 }
    );
  }
}
