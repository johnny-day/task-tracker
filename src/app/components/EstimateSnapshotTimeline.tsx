"use client";

import type { EstimateDayLog, EstimateSnapshot } from "@/lib/estimateSnapshotStorage";

interface EstimateSnapshotTimelineProps {
  dayLog: EstimateDayLog;
  onStartMyDay: () => void;
  /** When true, sits inside another card (no second bordered box). */
  embedded?: boolean;
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
}: EstimateSnapshotTimelineProps) {
  const started = Boolean(dayLog.startedAt);
  const snapshots = dayLog.snapshots;

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
            className="px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors font-medium text-sm whitespace-nowrap shadow-sm"
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
          midnight.
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
              className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm border-b border-border/40 pb-2 last:border-0 last:pb-0"
            >
              <span className="font-medium text-text tabular-nums">
                {formatRecorded(s.recordedAt)}
              </span>
              <span className="text-text-muted min-w-0 text-right sm:text-left">
                {snapshotLabel(s)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
