import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const hidden = await prisma.hiddenEvent.findMany({
    select: { eventId: true, summary: true },
  });
  return NextResponse.json(hidden);
}

export async function POST(req: NextRequest) {
  const { eventId, summary } = await req.json();

  if (!eventId || typeof eventId !== "string") {
    return NextResponse.json(
      { error: "eventId is required" },
      { status: 400 }
    );
  }

  const hidden = await prisma.hiddenEvent.upsert({
    where: { eventId },
    update: { summary: summary || "" },
    create: { eventId, summary: summary || "" },
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
