"use client";

import { CompletionEstimate as EstimateType } from "@/lib/types";

interface CompletionEstimateProps {
  estimate: EstimateType | null;
  loading: boolean;
}

export default function CompletionEstimate({
  estimate,
  loading,
}: CompletionEstimateProps) {
  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-3">
          Completion Estimate
        </h2>
        <div className="animate-pulse space-y-2">
          <div className="h-8 bg-border rounded w-1/2" />
          <div className="h-4 bg-border rounded w-3/4" />
        </div>
      </div>
    );
  }

  if (!estimate) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-3">
        Completion Estimate
      </h2>
      {estimate.totalTaskMinutes === 0 ? (
        <p className="text-success font-medium">
          All tasks done! You&apos;re free.
        </p>
      ) : (
        <>
          <div className="mb-3">
            {estimate.estimatedDoneTime ? (
              <p className="text-2xl font-bold text-text">
                Done by{" "}
                <span className="text-primary">
                  {estimate.estimatedDoneTime}
                </span>
              </p>
            ) : (
              <p className="text-lg font-semibold text-danger">
                Not enough time today
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="p-2 rounded-lg bg-primary-light/50">
              <p className="text-text-muted text-xs">Task time</p>
              <p className="font-semibold text-text">
                {estimate.totalTaskMinutes} min
              </p>
            </div>
            <div className="p-2 rounded-lg bg-fitness-light/50">
              <p className="text-text-muted text-xs">Exercise time</p>
              <p className="font-semibold text-text">
                {estimate.exerciseMinutes} min
              </p>
            </div>
            <div className="p-2 rounded-lg bg-calendar-light/50">
              <p className="text-text-muted text-xs">Calendar busy</p>
              <p className="font-semibold text-text">
                {estimate.calendarMinutes} min
              </p>
            </div>
            <div className="p-2 rounded-lg bg-success-light/50">
              <p className="text-text-muted text-xs">Free time</p>
              <p className="font-semibold text-text">
                {estimate.freeMinutes} min
              </p>
            </div>
          </div>
          {estimate.overflow && (
            <p className="mt-3 text-sm text-warning font-medium">
              Tasks + exercise exceed your free time today. Consider
              rescheduling.
            </p>
          )}
        </>
      )}
    </div>
  );
}
