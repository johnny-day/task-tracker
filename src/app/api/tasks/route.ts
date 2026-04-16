import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const statuses = url.searchParams.getAll("status");
  const date = url.searchParams.get("date");
  const updatedAfter = url.searchParams.get("updatedAfter");
  const updatedBefore = url.searchParams.get("updatedBefore");

  const where: Record<string, unknown> = {};
  if (statuses.length === 1) where.status = statuses[0];
  else if (statuses.length > 1) where.status = { in: statuses };
  if (date) where.dueDate = date;
  if (updatedAfter && updatedBefore) {
    where.updatedAt = {
      gte: new Date(updatedAfter),
      lte: new Date(updatedBefore),
    };
  }

  const completedRange = !!(updatedAfter && updatedBefore);

  const tasks = await prisma.task.findMany({
    where,
    orderBy: completedRange
      ? { updatedAt: "desc" }
      : [{ priority: "asc" }, { sortOrder: "asc" }],
  });

  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const maxOrder = await prisma.task.aggregate({ _max: { sortOrder: true } });
  const nextOrder = (maxOrder._max.sortOrder ?? 0) + 1;

  const task = await prisma.task.create({
    data: {
      title: body.title,
      estimatedMinutes: body.estimatedMinutes ?? 30,
      priority: body.priority ?? 2,
      status: body.status ?? "pending",
      category: body.category ?? "general",
      calendarEventId: body.calendarEventId ?? null,
      dueDate: body.dueDate ?? null,
      sortOrder: nextOrder,
    },
  });

  return NextResponse.json(task, { status: 201 });
}
