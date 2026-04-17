"use client";

interface FitnessWidgetProps {
  activeCalories: number;
  calorieGoal: number;
  calBurnRate: number;
  remaining: number;
  exerciseMinutesLeft: number;
  /** Last sync was before today in your time zone; numbers assume no activity yet today. */
  shortcutDataStale?: boolean;
}

export default function FitnessWidget({
  activeCalories,
  calorieGoal,
  calBurnRate,
  remaining,
  exerciseMinutesLeft,
  shortcutDataStale,
}: FitnessWidgetProps) {
  const progress = Math.min(100, (activeCalories / calorieGoal) * 100);
  const isComplete = remaining <= 0;

  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <h2 className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-4">
        Fitness
      </h2>
      <div className="flex items-end gap-2 mb-3">
        <span className="text-4xl font-black text-fitness tracking-tight">
          {Math.round(activeCalories)}
        </span>
        <span className="text-text-muted mb-1 font-medium">/ {calorieGoal} cal</span>
      </div>
      <div className="w-full h-2 bg-border rounded-full overflow-hidden mb-4">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${progress}%`,
            backgroundColor: isComplete
              ? "var(--color-success)"
              : "var(--color-fitness)",
          }}
        />
      </div>
      {isComplete ? (
        <p className="text-success font-medium text-sm">
          Goal reached! Great job.
        </p>
      ) : (
        <div className="space-y-1 text-sm">
          {shortcutDataStale && (
            <p className="text-xs text-text-muted mb-1">
              Today&apos;s activity hasn&apos;t synced yet; showing your full goal until the
              Shortcut runs.
            </p>
          )}
          <p className="text-text-muted">
            <span className="font-semibold text-text">{Math.round(remaining)}</span> cal
            remaining
          </p>
          <p className="text-text-muted">
            ~
            <span className="font-semibold text-text">
              {exerciseMinutesLeft}
            </span>{" "}
            min of exercise left
            <span className="text-xs ml-1">
              (at {Number.isFinite(calBurnRate) ? calBurnRate : 4} cal/min)
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
