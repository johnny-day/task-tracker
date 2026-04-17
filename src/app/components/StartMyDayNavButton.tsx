"use client";

import { usePathname, useRouter } from "next/navigation";

export const START_MY_DAY_EVENT = "tasktracker-start-my-day";

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

  return (
    <button
      type="button"
      onClick={() => {
        if (pathname === "/") {
          broadcastStartMyDay();
        } else {
          router.push("/?startMyDay=1");
        }
      }}
      className="shrink-0 px-3 py-1.5 rounded-md border-2 border-primary bg-primary/15 text-primary text-xs font-bold uppercase tracking-wide hover:bg-primary/25 transition-colors"
    >
      Start my day
    </button>
  );
}
