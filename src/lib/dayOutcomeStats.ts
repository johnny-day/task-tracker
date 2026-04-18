import type { DayOutcomeRecord } from "./dayOutcomeStorage";
import { localDateKey } from "./estimateSnapshotStorage";

/** YYYY-MM-DD at local noon → weekday 0–6 (Sun–Sat) */
export function weekdayFromDateKey(dateKey: string): number {
  const [y, mo, d] = dateKey.split("-").map(Number);
  if (!y || !mo || !d) return 0;
  return new Date(y, mo - 1, d, 12, 0, 0, 0).getDay();
}

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function formatMinutesFromMidnightAsClock(m: number): string {
  const total = Math.round(m);
  const h = Math.floor(total / 60) % 24;
  const min = total % 60;
  const d = new Date(2000, 0, 1, h, min, 0, 0);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function dateKeyAddDays(dateKey: string, deltaDays: number): string {
  const [y, mo, d] = dateKey.split("-").map(Number);
  if (!y || !mo || !d) return dateKey;
  const dt = new Date(y, mo - 1, d, 12, 0, 0, 0);
  dt.setDate(dt.getDate() + deltaDays);
  return localDateKey(dt);
}

/** Inclusive of today: last `n` calendar days in local time. */
export function minDateKeyLastNDays(n: number): string {
  if (n <= 1) return localDateKey();
  return dateKeyAddDays(localDateKey(), -(n - 1));
}

export function recordsInLastNDays(records: DayOutcomeRecord[], n: number): DayOutcomeRecord[] {
  if (n <= 0) return [];
  const minKey = minDateKeyLastNDays(n);
  return records.filter((r) => r.dateKey >= minKey);
}

/** Arithmetic mean of minutes-from-midnight (simple; ignores wrap at midnight). */
export function averageMinutes(records: DayOutcomeRecord[]): number | null {
  if (records.length === 0) return null;
  let sum = 0;
  for (const r of records) {
    sum += r.minutesFromLocalMidnight;
  }
  return sum / records.length;
}

export function averageByWeekday(records: DayOutcomeRecord[]): Record<number, number | null> {
  const buckets: number[][] = [[], [], [], [], [], [], []];
  for (const r of records) {
    const wd = weekdayFromDateKey(r.dateKey);
    buckets[wd].push(r.minutesFromLocalMidnight);
  }
  const out: Record<number, number | null> = {};
  for (let i = 0; i < 7; i++) {
    const arr = buckets[i];
    out[i] = arr.length === 0 ? null : arr.reduce((a, b) => a + b, 0) / arr.length;
  }
  return out;
}

export function recentRecordsDescending(
  records: DayOutcomeRecord[],
  max: number
): DayOutcomeRecord[] {
  return [...records].sort((a, b) => b.dateKey.localeCompare(a.dateKey)).slice(0, max);
}
