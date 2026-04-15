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

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function isPast(event: CalendarEvent): boolean {
  if (event.allDay) return false;
  return new Date(event.end) < new Date();
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

  const now = new Date();
  const nowTime = formatTime(now.toISOString());

  const todayEvents = events
    .filter((e) => {
      if (e.allDay) return isToday(e.start);
      return isToday(e.start) || isToday(e.end);
    })
    .sort((a, b) => {
      if (a.allDay && !b.allDay) return -1;
      if (!a.allDay && b.allDay) return 1;
      return new Date(a.start).getTime() - new Date(b.start).getTime();
    });

  const nowInsertIndex = todayEvents.findIndex(
    (e) => !e.allDay && new Date(e.start) > now
  );

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-3">
        Today&apos;s Calendar
      </h2>
      {todayEvents.length === 0 ? (
        <p className="text-sm text-text-muted">No events today.</p>
      ) : (
        <div className="space-y-2">
          {todayEvents.map((event, i) => {
            const past = isPast(event);
            const showNowBefore =
              nowInsertIndex === i && !event.allDay;

            return (
              <div key={event.id}>
                {showNowBefore && <NowLine time={nowTime} />}
                <div
                  className={`flex items-start gap-3 p-3 rounded-lg border ${
                    past
                      ? "bg-border/30 border-border opacity-50"
                      : "bg-calendar-light/50 border-calendar-light"
                  }`}
                >
                  <div
                    className={`w-1 self-stretch rounded-full shrink-0 ${
                      past ? "bg-text-muted" : "bg-calendar"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={`font-medium text-sm truncate ${
                        past ? "text-text-muted line-through" : "text-text"
                      }`}
                    >
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
              </div>
            );
          })}
          {nowInsertIndex === -1 && <NowLine time={nowTime} />}
        </div>
      )}
    </div>
  );
}

function NowLine({ time }: { time: string }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <div className="w-2.5 h-2.5 rounded-full bg-danger shrink-0" />
      <div className="flex-1 h-px bg-danger" />
      <span className="text-xs font-semibold text-danger whitespace-nowrap">
        {time}
      </span>
    </div>
  );
}
