import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  loadSettings,
  buildSelectList,
  rowToSettings,
  SETTINGS_DEFAULTS,
} from "@/lib/loadSettings";
import { NextRequest, NextResponse } from "next/server";

async function detectSettingsColumns(): Promise<Set<string>> {
  const rows = await prisma.$queryRaw<Array<{ column_name: string }>>(
    Prisma.sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'Settings'`
  );
  return new Set(rows.map((r) => r.column_name));
}

function parseSettingsPatch(raw: Record<string, unknown>): Record<string, unknown> {
  const data: Record<string, unknown> = {};

  if (typeof raw.wakeTime === "string") data.wakeTime = raw.wakeTime;
  if (typeof raw.sleepTime === "string") data.sleepTime = raw.sleepTime;
  if (typeof raw.calorieGoal === "number") {
    data.calorieGoal = Math.max(1, Math.round(raw.calorieGoal));
  }
  if (typeof raw.calBurnRate === "number") {
    data.calBurnRate = Math.max(0.1, raw.calBurnRate);
  }
  if (typeof raw.burnRateOnboardingDone === "boolean") {
    data.burnRateOnboardingDone = raw.burnRateOnboardingDone;
  }
  if ("fitnessTimeZone" in raw) {
    const v = raw.fitnessTimeZone;
    if (v === null || v === undefined) {
      data.fitnessTimeZone = null;
    } else if (typeof v === "string") {
      const t = v.trim();
      data.fitnessTimeZone = t === "" ? null : t;
    }
  }

  return data;
}

export async function GET() {
  try {
    const settings = await loadSettings();
    return NextResponse.json(settings);
  } catch (e) {
    console.error("[GET /api/settings]", e);
    return NextResponse.json(SETTINGS_DEFAULTS);
  }
}

export async function PATCH(req: NextRequest) {
  let raw: Record<string, unknown>;
  try {
    raw = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const patch = parseSettingsPatch(raw);
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  try {
    const dbCols = await detectSettingsColumns();

    await prisma.$executeRaw`
      INSERT INTO "Settings" (id, "wakeTime", "sleepTime", "calorieGoal", "calBurnRate")
      VALUES ('default', '07:00', '22:00', 700, 4.0)
      ON CONFLICT (id) DO NOTHING
    `;

    const setClauses: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const [key, val] of Object.entries(patch)) {
      if (!dbCols.has(key)) continue;
      setClauses.push(`"${key}" = $${idx}`);
      values.push(val);
      idx++;
    }

    if (setClauses.length > 0) {
      const sql = `UPDATE "Settings" SET ${setClauses.join(", ")} WHERE id = 'default'`;
      await prisma.$executeRawUnsafe(sql, ...values);
    }

    const select = buildSelectList(dbCols);
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT ${select} FROM "Settings" WHERE id = 'default'`
    );

    return NextResponse.json(rowToSettings(rows[0] ?? {}));
  } catch (e) {
    const message = e instanceof Error ? e.message : "Settings update failed";
    console.error("[PATCH /api/settings]", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
