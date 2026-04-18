"use client";

import { useMemo, useState } from "react";
import { loadOutcomeIndex } from "@/lib/dayOutcomeStorage";
import {
  averageByWeekday,
  averageMinutes,
  formatMinutesFromMidnightAsClock,
  recordsInLastNDays,
  recentRecordsDescending,
  WEEKDAY_LABELS,
} from "@/lib/dayOutcomeStats";

type Props = {
  /** Bumped when a new outcome is saved so lists stay fresh while open. */
  refreshKey: number;
};

export default function DayCompletionHistory({ refreshKey }: Props) {
  const [openCount, setOpenCount] = useState(0);

  const records = useMemo(
    () => loadOutcomeIndex(),
    [refreshKey, openCount]
  );

  const last7 = useMemo(() => recordsInLastNDays(records, 7), [records]);
  const last28 = useMemo(() => recordsInLastNDays(records, 28), [records]);
  const last90 = useMemo(() => recordsInLastNDays(records, 90), [records]);

  const avg7 = averageMinutes(last7);
  const avg28 = averageMinutes(last28);
  const avg90 = averageMinutes(last90);
  const byWd = useMemo(() => averageByWeekday(records), [records]);
  const recent = useMemo(() => recentRecordsDescending(records, 30), [records]);

  const maxBar =
    records.length > 0
      ? Math.max(
          1,
          ...Object.values(byWd).map((v) => (v == null ? 0 : v))
        )
      : 1;

  return (
    <details
      className="mt-3 border-t border-border/60 pt-3"
      onToggle={(e) => {
        if (e.currentTarget.open) setOpenCount((c) => c + 1);
      }}
    >
      <summary className="text-xs font-semibold text-text-muted uppercase tracking-wide cursor-pointer select-none">
        Full-day finish history
      </summary>
      <div className="mt-3 space-y-4 text-sm">
        {records.length === 0 ? (
          <p className="text-text-muted text-xs leading-relaxed">
            When you&apos;re fully done for the day (same as the hero message), we record
            the time here. Finish a full day to start tracking averages.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div className="p-2 rounded-lg bg-border/30">
                <p className="text-text-muted uppercase tracking-wider mb-0.5">7-day avg</p>
                <p className="font-semibold text-text tabular-nums">
                  {avg7 != null ? formatMinutesFromMidnightAsClock(avg7) : "—"}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-border/30">
                <p className="text-text-muted uppercase tracking-wider mb-0.5">28-day avg</p>
                <p className="font-semibold text-text tabular-nums">
                  {avg28 != null ? formatMinutesFromMidnightAsClock(avg28) : "—"}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-border/30">
                <p className="text-text-muted uppercase tracking-wider mb-0.5">90-day avg</p>
                <p className="font-semibold text-text tabular-nums">
                  {avg90 != null ? formatMinutesFromMidnightAsClock(avg90) : "—"}
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">
                By weekday (all history)
              </p>
              <div className="space-y-1.5">
                {([1, 2, 3, 4, 5, 6, 0] as const).map((wd) => {
                  const avg = byWd[wd];
                  const pct = avg == null ? 0 : Math.round((avg / maxBar) * 100);
                  return (
                    <div key={wd} className="flex items-center gap-2 text-xs">
                      <span className="w-8 shrink-0 text-text-muted font-medium">
                        {WEEKDAY_LABELS[wd]}
                      </span>
                      <div className="flex-1 h-2 rounded-full bg-border/50 overflow-hidden min-w-0">
                        {avg != null && (
                          <div
                            className="h-full rounded-full bg-primary/80"
                            style={{ width: `${pct}%` }}
                          />
                        )}
                      </div>
                      <span className="w-16 shrink-0 text-right text-text tabular-nums">
                        {avg != null ? formatMinutesFromMidnightAsClock(avg) : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">
                Recent days
              </p>
              <ul className="space-y-1 max-h-40 overflow-y-auto text-xs">
                {recent.map((r) => (
                  <li
                    key={r.dateKey}
                    className="flex justify-between gap-2 border-b border-border/30 pb-1 last:border-0"
                  >
                    <span className="text-text-muted tabular-nums">{r.dateKey}</span>
                    <span className="font-medium text-text tabular-nums">
                      {formatMinutesFromMidnightAsClock(r.minutesFromLocalMidnight)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </details>
  );
}
