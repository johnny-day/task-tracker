"use client";

import { loadDayLog, localDateKey } from "@/lib/estimateSnapshotStorage";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export const START_MY_DAY_EVENT = "tasktracker-start-my-day";

/** Fired after today’s day log gets `startedAt` (same tab; localStorage has no storage event). */
export const DAY_TRACKING_STARTED_EVENT = "tasktracker-day-tracking-started";

/** Fired when today’s persisted log changes in a way the nav should re-check (e.g. reset). */
export const DAY_LOG_MUTATED_EVENT = "tasktracker-day-log-mutated";

export function broadcastStartMyDay() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(START_MY_DAY_EVENT));
}

/**
 * Always visible in the top nav. On the dashboard it runs the tracker
 * immediately; from other pages it opens the dashboard with a flag so
 * the tracker can start after load.
 */
export default function StartMyDayNavButton() {
  const pathname = usePathname();
  const router = useRouter();
  const [todayStarted, setTodayStarted] = useState(false);

  useEffect(() => {
    const read = () => {
      setTodayStarted(Boolean(loadDayLog(localDateKey()).startedAt));
    };
    read();
    const onStarted = () => setTodayStarted(true);
    const onMutated = () => read();
    window.addEventListener(DAY_TRACKING_STARTED_EVENT, onStarted);
    window.addEventListener(DAY_LOG_MUTATED_EVENT, onMutated);
    return () => {
      window.removeEventListener(DAY_TRACKING_STARTED_EVENT, onStarted);
      window.removeEventListener(DAY_LOG_MUTATED_EVENT, onMutated);
    };
  }, [pathname]);

  const blocked = todayStarted;

  return (
    <button
      type="button"
      disabled={blocked}
      title={
        blocked
          ? "You already saved today’s timeline. Use Reset tracker in the dashboard if you need to start over."
          : undefined
      }
      onClick={() => {
        if (blocked) return;
        if (pathname === "/") {
          broadcastStartMyDay();
        } else {
          router.push("/?startMyDay=1");
        }
      }}
      className="shrink-0 px-3 py-1.5 rounded-md border-2 border-primary bg-primary/15 text-primary text-xs font-bold uppercase tracking-wide hover:bg-primary/25 transition-colors disabled:cursor-not-allowed disabled:opacity-45"
    >
      {blocked ? "Day started" : "Start my day"}
    </button>
  );
}
