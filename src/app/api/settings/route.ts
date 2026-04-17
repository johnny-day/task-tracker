import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

/** DB predates a Prisma-mapped column (P2022 or driver/validation-style messages). */
function isSettingsColumnMissingError(e: unknown, column: string): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  if (!msg.includes(column)) return false;
  return (
    msg.includes("does not exist") ||
    msg.includes("Unknown column") ||
    (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2022")
  );
}

function isBurnColumnMissingError(e: unknown): boolean {
  return isSettingsColumnMissingError(e, "burnRateOnboardingDone");
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

/** Build a Prisma-safe update object from the JSON body (no unknown keys). */
function parseSettingsPatch(raw: Record<string, unknown>): Prisma.SettingsUncheckedUpdateInput {
  const data: Prisma.SettingsUncheckedUpdateInput = {};

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

const OPTIONAL_SETTINGS_DB_COLUMNS = [
  "burnRateOnboardingDone",
  "fitnessTimeZone",
] as const;

function stripMissingSettingsColumnsFromErrorMessage(
  msg: string,
  payload: Prisma.SettingsUncheckedUpdateInput
): Prisma.SettingsUncheckedUpdateInput {
  const out = { ...payload } as Record<string, unknown>;
  for (const col of OPTIONAL_SETTINGS_DB_COLUMNS) {
    if (isSettingsColumnMissingError({ message: msg } as Error, col)) {
      delete out[col];
    }
  }
  return out as Prisma.SettingsUncheckedUpdateInput;
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
  let raw: Record<string, unknown>;
  try {
    raw = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data = parseSettingsPatch(raw);

  async function upsertPayload(payload: Prisma.SettingsUncheckedUpdateInput) {
    const create: Prisma.SettingsUncheckedCreateInput = {
      id: "default",
      wakeTime: typeof payload.wakeTime === "string" ? payload.wakeTime : "07:00",
      sleepTime: typeof payload.sleepTime === "string" ? payload.sleepTime : "22:00",
      calorieGoal: typeof payload.calorieGoal === "number" ? payload.calorieGoal : 700,
      calBurnRate: typeof payload.calBurnRate === "number" ? payload.calBurnRate : 4.0,
    };
    if (typeof payload.burnRateOnboardingDone === "boolean") {
      create.burnRateOnboardingDone = payload.burnRateOnboardingDone;
    }
    if ("fitnessTimeZone" in payload) {
      const tz = payload.fitnessTimeZone;
      create.fitnessTimeZone =
        tz === null || tz === undefined
          ? null
          : typeof tz === "string"
            ? tz
            : null;
    }

    return prisma.settings.upsert({
      where: { id: "default" },
      update: payload,
      create,
    });
  }

  let attempt: Prisma.SettingsUncheckedUpdateInput = data;
  let lastError: unknown;
  for (let i = 0; i < 6; i++) {
    try {
      const settings = await upsertPayload(attempt);
      return NextResponse.json(settings);
    } catch (e) {
      lastError = e;
      const msg = e instanceof Error ? e.message : String(e);
      const next = stripMissingSettingsColumnsFromErrorMessage(msg, attempt);
      const stripped =
        Object.keys(next).length < Object.keys(attempt).length ||
        OPTIONAL_SETTINGS_DB_COLUMNS.some(
          (col) => col in attempt && !(col in (next as object))
        );
      if (!stripped) {
        break;
      }
      attempt = next;
    }
  }

  const message =
    lastError instanceof Error ? lastError.message : "Settings update failed";
  console.error("[PATCH /api/settings]", lastError);
  return NextResponse.json({ error: message }, { status: 500 });
}
