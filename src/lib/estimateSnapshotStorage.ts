/**
 * Client-side persistence for "done by" estimate history.
 *
 * Future server sync: POST/GET JSON using the same `EstimateDayLog` /
 * `EstimateSnapshot` shapes; replace `loadDayLog` / `saveDayLog` with fetch
 * keyed by local calendar date (and later auth user id).
 */

export const SNAPSHOT_STORAGE_PREFIX = "tasktracker:estimateSnapshots:";
/** Compare in whole minutes so sub-minute noise never blocks a real 30+ min move. */
export const SNAPSHOT_THRESHOLD_MINUTES = 30;

/** Wall-clock instant for comparisons; null if unknown / overflow with no instant. */
export function normalizeDoneInstant(doneAtMs: number | null): number | null {
  if (doneAtMs === null || !Number.isFinite(doneAtMs)) return null;
  return Math.floor(doneAtMs / 60000);
}

export type EstimateSnapshot = {
  recordedAt: string;
  doneAtMs: number | null;
  doneByLabel: string | null;
  overflow: boolean;
};

export type EstimateDayLog = {
  v: 1;
  startedAt: string | null;
  snapshots: EstimateSnapshot[];
};

export function localDateKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function createEmptyEstimateDayLog(): EstimateDayLog {
  return { v: 1, startedAt: null, snapshots: [] };
}

function isValidSnapshot(x: unknown): x is EstimateSnapshot {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.recordedAt === "string" &&
    (o.doneAtMs === null || typeof o.doneAtMs === "number") &&
    (o.doneByLabel === null || typeof o.doneByLabel === "string") &&
    typeof o.overflow === "boolean"
  );
}

export function loadDayLog(dateKey: string): EstimateDayLog {
  if (typeof window === "undefined") return createEmptyEstimateDayLog();
  try {
    const raw = window.localStorage.getItem(
      SNAPSHOT_STORAGE_PREFIX + dateKey
    );
    if (!raw) return createEmptyEstimateDayLog();
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return createEmptyEstimateDayLog();
    const p = parsed as Record<string, unknown>;
    if (p.v !== 1 || !Array.isArray(p.snapshots)) return createEmptyEstimateDayLog();
    const snapshots = p.snapshots.filter(isValidSnapshot);
    return {
      v: 1,
      startedAt:
        typeof p.startedAt === "string" && p.startedAt.length > 0
          ? p.startedAt
          : null,
      snapshots,
    };
  } catch {
    return createEmptyEstimateDayLog();
  }
}

export function saveDayLog(dateKey: string, log: EstimateDayLog): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    SNAPSHOT_STORAGE_PREFIX + dateKey,
    JSON.stringify(log)
  );
}

/** Baseline after "Start my day" — clears prior snapshots for this date. */
export function createStartedDayLog(snapshot: EstimateSnapshot): EstimateDayLog {
  return {
    v: 1,
    startedAt: snapshot.recordedAt,
    snapshots: [snapshot],
  };
}

export function shouldAppendSnapshot(
  last: EstimateSnapshot | undefined,
  next: Pick<EstimateSnapshot, "doneAtMs" | "overflow">
): boolean {
  if (!last) return true;
  if (last.overflow !== next.overflow) return true;
  const a = normalizeDoneInstant(last.doneAtMs);
  const b = normalizeDoneInstant(next.doneAtMs);
  if (a === null && b === null) return false;
  if (a === null || b === null) return true;
  return Math.abs(b - a) >= SNAPSHOT_THRESHOLD_MINUTES;
}

export function makeSnapshotFromDoneBy(doneBy: {
  timeStr: string | null;
  doneAtMs: number | null;
  overflow: boolean;
}): EstimateSnapshot {
  return {
    recordedAt: new Date().toISOString(),
    doneAtMs: doneBy.doneAtMs,
    doneByLabel: doneBy.timeStr,
    overflow: doneBy.overflow,
  };
}
