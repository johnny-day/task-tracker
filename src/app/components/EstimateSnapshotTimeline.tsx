"use client";

import type { EstimateDayLog, EstimateSnapshot } from "@/lib/estimateSnapshotStorage";

interface EstimateSnapshotTimelineProps {
  dayLog: EstimateDayLog;
  onStartMyDay: () => void;
  /** When true, sits inside another card (no second bordered box). */
  embedded?: boolean;
  /** When false, Start my day is disabled (e.g. estimate inputs still loading). */
  startMyDayDisabled?: boolean;
  /** Remove one saved point by its index in the list (newest last in storage order). */
  onRemoveSnapshot?: (index: number) => void;
  /** Drop every point but keep the same “day started” record. */
  onClearAllSnapshots?: () => void;
  /** Clear start time and all points (fresh day). */
  onResetDayTracking?: () => void;
}

function formatRecorded(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function snapshotLabel(s: EstimateSnapshot): string {
  if (s.overflow) return "Not enough time (overflow)";
  if (s.doneByLabel) return `Done by ${s.doneByLabel}`;
  return "No finish time";
}

export default function EstimateSnapshotTimeline({
  dayLog,
  onStartMyDay,
  embedded = false,
  startMyDayDisabled = false,
  onRemoveSnapshot,
  onClearAllSnapshots,
  onResetDayTracking,
}: EstimateSnapshotTimelineProps) {
  const started = Boolean(dayLog.startedAt);
  const snapshots = dayLog.snapshots;
  const canEditSnapshots = Boolean(onRemoveSnapshot);
  const hasTrackingData = started || snapshots.length > 0;

  const rootClass = embedded
    ? "mt-5 pt-5 border-t border-border text-left"
    : "bg-card border border-border rounded-lg p-4 text-left";

  return (
    <div className={rootClass}>
      <div
        className={
          embedded
            ? "space-y-3 mb-3"
            : "flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3"
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-2 gap-y-3">
          {embedded ? (
            <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wide">
              Done-by time tracker
            </h3>
          ) : (
            <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wide">
              Done-by time tracker
            </h2>
          )}
          <button
            type="button"
            onClick={onStartMyDay}
            disabled={startMyDayDisabled}
            title={
              startMyDayDisabled
                ? "Loading tasks, calendar, activity, and settings for your estimate…"
                : undefined
            }
            className="px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors font-medium text-sm whitespace-nowrap shadow-sm disabled:cursor-not-allowed disabled:opacity-45"
          >
            Start my day
          </button>
        </div>
        <p className="text-xs text-text-muted max-w-xl">
          Saved on this device only. We add a point when your estimated
          &quot;done by&quot; time moves by{" "}
          <strong className="text-text">30 minutes or more</strong> (rounded to
          the clock minute). We also check about once a minute so the day
          sliding forward can still create a new point. Resets at local
          midnight. Remove mistaken rows, clear all points, or reset the whole
          tracker below when you need a clean slate.
        </p>
      </div>

      {!started ? (
        <p className="text-sm text-text-muted">
          Tap <strong className="text-text">Start my day</strong> after
          you&apos;ve entered your tasks — we&apos;ll record your first
          estimate and then log big shifts as you crush your list.
        </p>
      ) : snapshots.length === 0 ? (
        <p className="text-sm text-text-muted">No snapshots yet.</p>
      ) : (
        <ul className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {snapshots.map((s, i) => (
            <li
              key={`${s.recordedAt}-${i}`}
              className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-sm border-b border-border/40 pb-2 last:border-0 last:pb-0"
            >
              <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-medium text-text tabular-nums">
                  {formatRecorded(s.recordedAt)}
                </span>
                <span className="text-text-muted min-w-0 sm:text-left">
                  {snapshotLabel(s)}
                </span>
              </div>
              {canEditSnapshots && (
                <button
                  type="button"
                  onClick={() => onRemoveSnapshot?.(i)}
                  className="shrink-0 rounded-md border border-border px-2 py-1 text-xs font-medium text-text-muted hover:border-danger/60 hover:bg-danger-light hover:text-danger transition-colors"
                  aria-label={`Remove estimate at ${formatRecorded(s.recordedAt)}`}
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {hasTrackingData &&
        (onClearAllSnapshots || onResetDayTracking) && (
          <div
            className={
              embedded
                ? "mt-4 flex flex-col gap-2 border-t border-border/60 pt-4 sm:flex-row sm:flex-wrap sm:items-center"
                : "mt-4 flex flex-col gap-2 border-t border-border/60 pt-4 sm:flex-row sm:flex-wrap sm:items-center"
            }
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-text-muted w-full sm:w-auto sm:mr-2">
              Fix data
            </p>
            {onClearAllSnapshots && started && snapshots.length > 0 && (
              <button
                type="button"
                onClick={onClearAllSnapshots}
                className="rounded-lg border border-border px-3 py-2 text-left text-xs font-medium text-text hover:border-warning/60 hover:bg-warning-light transition-colors sm:text-center"
              >
                Clear all points
                <span className="mt-0.5 block font-normal text-text-muted">
                  Keeps your day start; only removes saved timestamps
                </span>
              </button>
            )}
            {onResetDayTracking && (
              <button
                type="button"
                onClick={onResetDayTracking}
                className="rounded-lg border border-danger/40 px-3 py-2 text-left text-xs font-medium text-danger hover:bg-danger-light transition-colors sm:text-center"
              >
                Reset tracker for today
                <span className="mt-0.5 block font-normal text-text-muted">
                  Removes start time and every point
                </span>
              </button>
            )}
          </div>
        )}
    </div>
  );
}
