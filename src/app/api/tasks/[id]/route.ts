import { prisma } from "@/lib/prisma";
import { loadSettings } from "@/lib/loadSettings";
import { todayInTimeZone } from "@/lib/todayInTimeZone";
import { normalizeCategory } from "@/lib/taskCategories";
import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body: unknown = await req.json();
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;

  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data: Prisma.TaskUpdateInput = {};

  if (typeof b.title === "string") data.title = b.title;
  if (typeof b.estimatedMinutes === "number" && Number.isFinite(b.estimatedMinutes)) {
    data.estimatedMinutes = Math.max(1, Math.round(b.estimatedMinutes));
  }
  if (typeof b.status === "string") data.status = b.status;
  if (b.category !== undefined) {
    data.category = normalizeCategory(b.category);
  }
  if (b.calendarEventId !== undefined) {
    data.calendarEventId =
      b.calendarEventId === null || b.calendarEventId === ""
        ? null
        : String(b.calendarEventId);
  }
  if (b.scheduledStart !== undefined) {
    data.scheduledStart =
      b.scheduledStart === null || b.scheduledStart === ""
        ? null
        : new Date(String(b.scheduledStart));
  }
  if (typeof b.sortOrder === "number" && Number.isFinite(b.sortOrder)) {
    data.sortOrder = Math.round(b.sortOrder);
  }
  if (b.dueDate !== undefined) {
    data.dueDate =
      b.dueDate === null || b.dueDate === "" ? null : String(b.dueDate);
  }
  if (typeof b.repeatDaily === "boolean") {
    data.repeatDaily = b.repeatDaily;
  }

  const nextStatus =
    typeof data.status === "string" ? data.status : existing.status;
  const nextRepeat =
    typeof data.repeatDaily === "boolean"
      ? data.repeatDaily
      : existing.repeatDaily;

  const settings = await loadSettings();
  const today = todayInTimeZone(settings.fitnessTimeZone);

  if (nextStatus === "done" && nextRepeat) {
    data.lastCompletedLocalDate = today;
  } else if (nextStatus !== "done") {
    data.lastCompletedLocalDate = null;
  } else {
    data.lastCompletedLocalDate = null;
  }

  const task = await prisma.task.update({
    where: { id },
    data,
  });

  return NextResponse.json(task);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  await prisma.task.delete({ where: { id } });

  return NextResponse.json({ deleted: true });
}
