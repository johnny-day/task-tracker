import { formatZonedYmd } from "./zonedDayStart";

export type FitnessLogInput = {
  date: string;
  activeCalories: number;
  updatedAt: Date;
} | null;

export type ResolveFitnessInput = {
  /** YYYY-MM-DD row key / requested calendar day */
  today: string;
  /** IANA zone from client (Shortcut alignment) */
  tz: string | null;
  /** Browser local-midnight ISO; used for stale only when `tz` is absent */
  dayStartParam: string | null;
  log: FitnessLogInput;
  calorieGoal: number;
  calBurnRate: number;
};

export type ResolveFitnessResult = {
  activeCalories: number;
  remaining: number;
  exerciseMinutesLeft: number;
  shortcutDataStale: boolean;
  logYmdInTz: string | null;
  storedActiveCalories: number | null;
};

/**
 * Pure fitness numbers for GET /api/fitness (and automated checks).
 */
export function resolveFitnessFromLog(input: ResolveFitnessInput): ResolveFitnessResult {
  const { today, tz, dayStartParam, log, calorieGoal, calBurnRate } = input;

  const storedActiveCalories = Number(log?.activeCalories ?? 0);
  let burned = Number.isFinite(storedActiveCalories) && storedActiveCalories >= 0 ? storedActiveCalories : 0;

  const logYmdInTz = log && tz ? formatZonedYmd(log.updatedAt.getTime(), tz) : null;

  let isShortcutStale = false;
  if (log) {
    if (tz) {
      if (logYmdInTz != null && logYmdInTz < today) {
        isShortcutStale = true;
      }
    } else if (dayStartParam) {
      const boundary = new Date(dayStartParam);
      if (!Number.isNaN(boundary.getTime()) && log.updatedAt < boundary) {
        isShortcutStale = true;
      }
    }
  }

  if (isShortcutStale) {
    burned = 0;
  }

  const remaining = isShortcutStale ? calorieGoal : Math.max(0, calorieGoal - burned);

  let exerciseMinutesLeft = 0;
  if (remaining > 0) {
    const rawMinutes = Math.ceil(remaining / calBurnRate);
    exerciseMinutesLeft = Number.isFinite(rawMinutes) ? Math.max(1, rawMinutes) : 1;
  }

  return {
    activeCalories: burned,
    remaining,
    exerciseMinutesLeft,
    shortcutDataStale: isShortcutStale,
    logYmdInTz,
    storedActiveCalories: log != null ? storedActiveCalories : null,
  };
}
