import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export type SettingsRow = {
  id: string;
  wakeTime: string;
  sleepTime: string;
  calorieGoal: number;
  calBurnRate: number;
  burnRateOnboardingDone: boolean;
  fitnessTimeZone: string | null;
};

export const SETTINGS_DEFAULTS: SettingsRow = {
  id: "default",
  wakeTime: "07:00",
  sleepTime: "22:00",
  calorieGoal: 700,
  calBurnRate: 4.0,
  burnRateOnboardingDone: true,
  fitnessTimeZone: null,
};

const CORE_COLUMNS = ["wakeTime", "sleepTime", "calorieGoal", "calBurnRate"] as const;

async function detectSettingsColumns(): Promise<Set<string>> {
  const rows = await prisma.$queryRaw<Array<{ column_name: string }>>(
    Prisma.sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'Settings'`
  );
  return new Set(rows.map((r) => r.column_name));
}

export function buildSelectList(dbCols: Set<string>): string {
  const cols: string[] = ["id", ...CORE_COLUMNS];
  if (dbCols.has("burnRateOnboardingDone")) cols.push("burnRateOnboardingDone");
  if (dbCols.has("fitnessTimeZone")) cols.push("fitnessTimeZone");
  return cols.map((c) => `"${c}"`).join(", ");
}

export function rowToSettings(row: Record<string, unknown>): SettingsRow {
  return {
    id: String(row.id ?? "default"),
    wakeTime: typeof row.wakeTime === "string" ? row.wakeTime : SETTINGS_DEFAULTS.wakeTime,
    sleepTime: typeof row.sleepTime === "string" ? row.sleepTime : SETTINGS_DEFAULTS.sleepTime,
    calorieGoal: typeof row.calorieGoal === "number" ? row.calorieGoal : SETTINGS_DEFAULTS.calorieGoal,
    calBurnRate: typeof row.calBurnRate === "number" ? row.calBurnRate : SETTINGS_DEFAULTS.calBurnRate,
    burnRateOnboardingDone:
      typeof row.burnRateOnboardingDone === "boolean"
        ? row.burnRateOnboardingDone
        : SETTINGS_DEFAULTS.burnRateOnboardingDone,
    fitnessTimeZone:
      row.fitnessTimeZone === null || row.fitnessTimeZone === undefined
        ? null
        : typeof row.fitnessTimeZone === "string"
          ? row.fitnessTimeZone
          : null,
  };
}

/**
 * Read the Settings row using only columns that exist in the DB.
 * Safe against missing migrations (burnRateOnboardingDone, fitnessTimeZone).
 */
export async function loadSettings(): Promise<SettingsRow> {
  try {
    const dbCols = await detectSettingsColumns();
    const select = buildSelectList(dbCols);
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT ${select} FROM "Settings" WHERE id = 'default'`
    );
    if (rows.length > 0) return rowToSettings(rows[0]);
  } catch (e) {
    console.error("[loadSettings] raw query failed, returning defaults", e);
  }
  return { ...SETTINGS_DEFAULTS };
}
