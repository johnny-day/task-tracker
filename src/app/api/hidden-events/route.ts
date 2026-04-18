import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  const today = new URL(req.url).searchParams.get("today");
  if (today && ISO_DATE.test(today)) {
    await prisma.hiddenEvent.deleteMany({
      where: {
        scheduledDateKey: { not: null, lt: today },
      },
    });
  }

  const hidden = await prisma.hiddenEvent.findMany({
    select: { eventId: true, summary: true, scheduledDateKey: true },
  });
  return NextResponse.json(hidden);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { eventId, summary } = body;
  const rawKey = body.scheduledDateKey;
  const scheduledDateKey =
    typeof rawKey === "string" && ISO_DATE.test(rawKey.trim()) ? rawKey.trim() : null;

  if (!eventId || typeof eventId !== "string") {
    return NextResponse.json(
      { error: "eventId is required" },
      { status: 400 }
    );
  }

  const hidden = await prisma.hiddenEvent.upsert({
    where: { eventId },
    update: {
      summary: summary || "",
      ...(scheduledDateKey != null ? { scheduledDateKey } : {}),
    },
    create: {
      eventId,
      summary: summary || "",
      ...(scheduledDateKey != null ? { scheduledDateKey } : {}),
    },
  });

  return NextResponse.json(hidden);
}

export async function DELETE(req: NextRequest) {
  const { eventId } = await req.json();

  if (!eventId || typeof eventId !== "string") {
    return NextResponse.json(
      { error: "eventId is required" },
      { status: 400 }
    );
  }

  await prisma.hiddenEvent.deleteMany({ where: { eventId } });

  return NextResponse.json({ ok: true });
}
