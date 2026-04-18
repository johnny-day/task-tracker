import type { CalendarEvent } from "@/lib/types";
import { localDateKey } from "@/lib/estimateSnapshotStorage";

/** Local YYYY-MM-DD for the calendar day an event is scheduled on (used to prune hidden rows). */
export function eventCalendarDayKey(ev: Pick<CalendarEvent, "start" | "allDay">): string {
  const s = ev.start.trim();
  if (ev.allDay) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return localDateKey(new Date(s));
  }
  return localDateKey(new Date(s));
}
