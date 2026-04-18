/**
 * Client-side persistence for "full day clear" completion (hero matches:
 * tasks + exercise + no remaining meetings).
 * Final wall time updates if the user leaves and re-enters done-for-day the same calendar day.
 */

export const DAY_OUTCOMES_STORAGE_KEY = "tasktracker:dayOutcomesIndex:v1";

export type DayOutcomeRecord = {
  dateKey: string;
  achievedAtMs: number;
  achievedAtIso: string;
  doneByLabel: string | null;
  /** Local wall time on dateKey for averaging by weekday */
  minutesFromLocalMidnight: number;
};

function isValidRecord(x: unknown): x is DayOutcomeRecord {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.dateKey === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(o.dateKey) &&
    typeof o.achievedAtMs === "number" &&
    Number.isFinite(o.achievedAtMs) &&
    typeof o.achievedAtIso === "string" &&
    (o.doneByLabel === null || typeof o.doneByLabel === "string") &&
    typeof o.minutesFromLocalMidnight === "number" &&
    Number.isFinite(o.minutesFromLocalMidnight)
  );
}

/** Minutes since local midnight for a wall-clock instant. */
export function minutesFromLocalMidnightAt(ms: number): number {
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

export function loadOutcomeIndex(): DayOutcomeRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DAY_OUTCOMES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidRecord);
  } catch {
    return [];
  }
}

function saveOutcomeIndex(rows: DayOutcomeRecord[]): void {
  if (typeof window === "undefined") return;
  const sorted = [...rows].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  window.localStorage.setItem(DAY_OUTCOMES_STORAGE_KEY, JSON.stringify(sorted));
}

/**
 * Upsert today's outcome with latest wall time when re-clearing the same day.
 * Returns true if storage was updated.
 */
export function upsertDayOutcome(params: {
  dateKey: string;
  achievedAtMs: number;
  doneByLabel: string | null;
}): boolean {
  const minutesFromLocalMidnight = minutesFromLocalMidnightAt(params.achievedAtMs);
  const next: DayOutcomeRecord = {
    dateKey: params.dateKey,
    achievedAtMs: params.achievedAtMs,
    achievedAtIso: new Date(params.achievedAtMs).toISOString(),
    doneByLabel: params.doneByLabel,
    minutesFromLocalMidnight,
  };
  const idx = loadOutcomeIndex();
  const existing = idx.find((r) => r.dateKey === params.dateKey);
  const changed =
    !existing ||
    Math.abs(existing.achievedAtMs - params.achievedAtMs) >= 30_000 ||
    existing.doneByLabel !== next.doneByLabel;
  if (!changed) return false;
  const rest = idx.filter((r) => r.dateKey !== params.dateKey);
  rest.push(next);
  saveOutcomeIndex(rest);
  return true;
}
