import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  let settings = await prisma.settings.findUnique({
    where: { id: "default" },
  });

  if (!settings) {
    settings = await prisma.settings.create({
      data: { id: "default" },
    });
  }

  return NextResponse.json(settings);
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();

  if (typeof body.calBurnRate === "number") {
    body.calBurnRate = Math.max(0.1, body.calBurnRate);
  }
  if (typeof body.calorieGoal === "number") {
    body.calorieGoal = Math.max(1, Math.round(body.calorieGoal));
  }

  const settings = await prisma.settings.upsert({
    where: { id: "default" },
    update: body,
    create: { id: "default", ...body },
  });

  return NextResponse.json(settings);
}
