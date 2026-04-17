"use client";

import type { EstimateDayLog, EstimateSnapshot } from "@/lib/estimateSnapshotStorage";

interface EstimateSnapshotTimelineProps {
  dayLog: EstimateDayLog;
  onStartMyDay: () => void;
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
}: EstimateSnapshotTimelineProps) {
  const started = Boolean(dayLog.startedAt);
  const snapshots = dayLog.snapshots;

  return (
    <div className="bg-card border border-border rounded-lg p-4 text-left">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
        <div>
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wide">
            Done-by time tracker
          </h2>
          <p className="text-xs text-text-muted mt-1 max-w-xl">
            Saved on this device only. We add a point when your estimated
            &quot;done by&quot; time moves by{" "}
            <strong className="text-text">30 minutes or more</strong>. Resets
            at local midnight.
          </p>
        </div>
        <button
          type="button"
          onClick={onStartMyDay}
          className="shrink-0 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors font-medium text-sm whitespace-nowrap"
        >
          Start my day
        </button>
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
