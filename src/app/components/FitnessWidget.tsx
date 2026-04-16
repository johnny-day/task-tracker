"use client";

interface FitnessWidgetProps {
  activeCalories: number;
  calorieGoal: number;
  remaining: number;
  exerciseMinutesLeft: number;
}

export default function FitnessWidget({
  activeCalories,
  calorieGoal,
  remaining,
  exerciseMinutesLeft,
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
            <span className="text-xs ml-1">(at 4 cal/min)</span>
          </p>
        </div>
      )}
    </div>
  );
}
