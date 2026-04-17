import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

function isBurnColumnMissingError(e: unknown): boolean {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2022") return true;
    return String(e.message ?? "").includes("burnRateOnboardingDone");
  }
  return false;
}

/** Read Settings row when DB predates `burnRateOnboardingDone` migration. */
async function getSettingsLegacyRow() {
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      wakeTime: string;
      sleepTime: string;
      calorieGoal: number;
      calBurnRate: number;
    }>
  >(
    Prisma.sql`SELECT id, "wakeTime", "sleepTime", "calorieGoal", "calBurnRate" FROM "Settings" WHERE id = 'default'`
  );
  return rows[0] ?? null;
}

export async function GET() {
  try {
    let settings = await prisma.settings.findUnique({
      where: { id: "default" },
    });

    if (!settings) {
      settings = await prisma.settings.create({
        data: { id: "default" },
      });
    }

    return NextResponse.json(settings);
  } catch (e) {
    if (!isBurnColumnMissingError(e)) {
      throw e;
    }

    const row = await getSettingsLegacyRow();
    if (row) {
      return NextResponse.json({
        ...row,
        burnRateOnboardingDone: true,
        fitnessTimeZone: null,
      });
    }

    return NextResponse.json({
      id: "default",
      wakeTime: "07:00",
      sleepTime: "22:00",
      calorieGoal: 700,
      calBurnRate: 4.0,
      burnRateOnboardingDone: true,
      fitnessTimeZone: null,
    });
  }
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();

  if (typeof body.calBurnRate === "number") {
    body.calBurnRate = Math.max(0.1, body.calBurnRate);
  }
  if (typeof body.calorieGoal === "number") {
    body.calorieGoal = Math.max(1, Math.round(body.calorieGoal));
  }
  if (typeof body.fitnessTimeZone === "string") {
    const t = body.fitnessTimeZone.trim();
    body.fitnessTimeZone = t === "" ? null : t;
  }

  async function upsertPayload(payload: Record<string, unknown>) {
    return prisma.settings.upsert({
      where: { id: "default" },
      update: payload,
      create: { id: "default", ...payload },
    });
  }

  try {
    const settings = await upsertPayload(body);
    return NextResponse.json(settings);
  } catch (e) {
    if (!isBurnColumnMissingError(e) || !("burnRateOnboardingDone" in body)) {
      throw e;
    }
    const { burnRateOnboardingDone: _drop, ...rest } = body;
    const settings = await upsertPayload(rest);
    return NextResponse.json({
      ...settings,
      burnRateOnboardingDone: true,
    });
  }
}
