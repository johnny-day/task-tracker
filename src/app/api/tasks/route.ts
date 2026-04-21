import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { rolloverRepeatingTasks } from "@/lib/rolloverRepeatingTasks";
import { normalizeCategory, sortTasksByCategoryThenOrder } from "@/lib/taskCategories";

export async function GET(req: NextRequest) {
  try {
    await rolloverRepeatingTasks();
  } catch (e) {
    console.error("[tasks GET] rolloverRepeatingTasks:", e);
    return NextResponse.json(
      {
        error: "Database setup failed (run migrations).",
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 500 }
    );
  }

  try {
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
        : { sortOrder: "asc" },
    });

    const ordered = completedRange
      ? tasks
      : sortTasksByCategoryThenOrder(tasks);

    return NextResponse.json(ordered);
  } catch (e) {
    console.error("[tasks GET] findMany:", e);
    return NextResponse.json(
      {
        error: "Could not load tasks.",
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await rolloverRepeatingTasks();
  } catch (e) {
    console.error("[tasks POST] rolloverRepeatingTasks:", e);
    return NextResponse.json(
      {
        error: "Database setup failed (run migrations).",
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();

    const maxOrder = await prisma.task.aggregate({ _max: { sortOrder: true } });
    const nextOrder = (maxOrder._max.sortOrder ?? 0) + 1;

    const task = await prisma.task.create({
      data: {
        title: body.title,
        estimatedMinutes: body.estimatedMinutes ?? 30,
        status: body.status ?? "pending",
        category: normalizeCategory(body.category),
        calendarEventId: body.calendarEventId ?? null,
        dueDate: body.dueDate ?? null,
        sortOrder: nextOrder,
        repeatDaily: body.repeatDaily === true,
      },
    });

    return NextResponse.json(task, { status: 201 });
  } catch (e) {
    console.error("[tasks POST] create:", e);
    return NextResponse.json(
      {
        error: "Could not create task.",
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 500 }
    );
  }
}
