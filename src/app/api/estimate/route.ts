import { prisma } from "@/lib/prisma";
import { loadSettings } from "@/lib/loadSettings";
import { calculateEstimate } from "@/lib/estimate";
import { NextRequest, NextResponse } from "next/server";
import { CalendarEvent } from "@/lib/types";

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

  const settings = await loadSettings();
  const today = todayInTimeZone(settings.fitnessTimeZone);

  const [tasks, fitnessLog] = await Promise.all([
    prisma.task.findMany({
      where: { status: { not: "done" }, OR: [{ dueDate: today }, { dueDate: null }] },
      orderBy: [{ priority: "asc" }, { sortOrder: "asc" }],
    }),
    prisma.fitnessLog.findUnique({ where: { date: today } }),
  ]);

  const estimate = calculateEstimate(
    tasks,
    calendarEvents,
    fitnessLog?.activeCalories ?? 0,
    settings
  );

  return NextResponse.json(estimate);
}
