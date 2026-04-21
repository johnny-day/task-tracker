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
  const all = new URL(req.url).searchParams.get("all");
  if (all === "1" || all === "true") {
    const result = await prisma.hiddenEvent.deleteMany();
    return NextResponse.json({ ok: true, cleared: result.count });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "eventId is required, or use ?all=1 to clear all" },
      { status: 400 }
    );
  }
  const eventId =
    typeof body === "object" && body !== null && "eventId" in body
      ? (body as { eventId: unknown }).eventId
      : undefined;

  if (!eventId || typeof eventId !== "string") {
    return NextResponse.json(
      { error: "eventId is required" },
      { status: 400 }
    );
  }

  await prisma.hiddenEvent.deleteMany({ where: { eventId } });

  return NextResponse.json({ ok: true });
}
