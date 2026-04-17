import { exerciseMinutesFromBurnProgress } from "./fitnessExerciseMinutes";
import { formatZonedYmd, getZonedDayStartMs } from "./zonedDayStart";

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

  /**
   * Stale = last write was *before* local midnight of `today` in `tz`.
   * Comparing `formatZonedYmd(updatedAt)` to `today` wrongly flags fresh syncs
   * when UTC instant maps to the previous calendar date in that zone.
   */
  let isShortcutStale = false;
  if (log) {
    if (tz) {
      const dayStartMs = getZonedDayStartMs(today, tz);
      if (dayStartMs != null) {
        if (log.updatedAt.getTime() < dayStartMs) {
          isShortcutStale = true;
        }
      } else if (logYmdInTz != null && logYmdInTz < today) {
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

  const exerciseMinutesLeft = exerciseMinutesFromBurnProgress(
    calorieGoal,
    burned,
    calBurnRate
  );

  return {
    activeCalories: burned,
    remaining,
    exerciseMinutesLeft,
    shortcutDataStale: isShortcutStale,
    logYmdInTz,
    storedActiveCalories: log != null ? storedActiveCalories : null,
  };
}
