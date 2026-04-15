"use client";

import { CalendarEvent } from "@/lib/types";

interface CalendarTimelineProps {
  events: CalendarEvent[];
  connected: boolean;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function eventDuration(event: CalendarEvent): string {
  if (event.allDay) return "All day";
  const start = new Date(event.start).getTime();
  const end = new Date(event.end).getTime();
  const mins = Math.round((end - start) / 60000);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function CalendarTimeline({
  events,
  connected,
}: CalendarTimelineProps) {
  if (!connected) {
    return (
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-3">
          Calendar
        </h2>
        <p className="text-sm text-text-muted">
          Connect Google Calendar in{" "}
          <a href="/settings" className="text-primary hover:underline">
            Settings
          </a>{" "}
          to see today&apos;s events.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-3">
        Today&apos;s Calendar
      </h2>
      {events.length === 0 ? (
        <p className="text-sm text-text-muted">No events today.</p>
      ) : (
        <div className="space-y-2">
          {events.map((event) => (
            <div
              key={event.id}
              className="flex items-start gap-3 p-3 rounded-lg bg-calendar-light/50 border border-calendar-light"
            >
              <div className="w-1 self-stretch rounded-full bg-calendar shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm text-text truncate">
                  {event.summary}
                </p>
                <p className="text-xs text-text-muted">
                  {event.allDay
                    ? "All day"
                    : `${formatTime(event.start)} - ${formatTime(event.end)}`}
                  <span className="ml-2 opacity-70">
                    {eventDuration(event)}
                  </span>
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
