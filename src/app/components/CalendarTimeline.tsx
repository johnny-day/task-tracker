"use client";

import { useState } from "react";
import { CalendarEvent, Task } from "@/lib/types";

interface CalendarTimelineProps {
  events: CalendarEvent[];
  connected: boolean;
  pinnedTasks?: Task[];
  onScheduleTask?: (taskId: string, scheduledStart: string | null) => void;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function eventDuration(event: CalendarEvent): string {
  if (event.allDay) return "All day";
  const mins = Math.round(
    (new Date(event.end).getTime() - new Date(event.start).getTime()) / 60000
  );
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

function isPast(endIso: string): boolean {
  return new Date(endIso) < new Date();
}

interface TimelineEntry {
  type: "event" | "task" | "now";
  time: number;
  event?: CalendarEvent;
  task?: Task;
}

export default function CalendarTimeline({
  events,
  connected,
  pinnedTasks = [],
  onScheduleTask,
}: CalendarTimelineProps) {
  const [dragOverId, setDragOverId] = useState<string | null>(null);

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

  const todayPinned = pinnedTasks.filter(
    (t) => t.scheduledStart && isToday(t.scheduledStart)
  );

  const entries: TimelineEntry[] = [];

  for (const ev of todayEvents) {
    entries.push({
      type: "event",
      time: ev.allDay ? 0 : new Date(ev.start).getTime(),
      event: ev,
    });
  }

  const eventStartTimes = new Set(todayEvents.map((e) => e.start));
  for (const t of todayPinned) {
    if (!eventStartTimes.has(t.scheduledStart!)) {
      entries.push({
        type: "task",
        time: new Date(t.scheduledStart!).getTime(),
        task: t,
      });
    }
  }

  entries.sort((a, b) => a.time - b.time);

  function handleDrop(targetTime: string, e: React.DragEvent) {
    e.preventDefault();
    setDragOverId(null);
    const taskId = e.dataTransfer.getData("text/task-id");
    if (taskId && onScheduleTask) {
      onScheduleTask(taskId, targetTime);
    }
  }

  function midpoint(aEnd: string, bStart: string): string {
    const mid =
      (new Date(aEnd).getTime() + new Date(bStart).getTime()) / 2;
    const d = new Date(mid);
    d.setSeconds(0, 0);
    return d.toISOString();
  }

  function renderDropZone(dropTime: string, label: string, id: string) {
    const active = dragOverId === id;
    return (
      <div
        key={id}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setDragOverId(id);
        }}
        onDragLeave={() => setDragOverId(null)}
        onDrop={(e) => handleDrop(dropTime, e)}
        className={`border-2 border-dashed rounded-lg text-center text-xs py-2 transition-all ${
          active
            ? "border-primary bg-primary-light/50 text-primary font-semibold"
            : "border-border/50 text-text-muted/50 hover:border-primary/30"
        }`}
      >
        {active ? "Drop here" : label}
      </div>
    );
  }

  const timedEntries = entries.filter(
    (e) => !(e.type === "event" && e.event?.allDay)
  );
  const allDayEntries = entries.filter(
    (e) => e.type === "event" && e.event?.allDay
  );

  function getEndTime(entry: TimelineEntry): string {
    if (entry.type === "event" && entry.event) return entry.event.end;
    if (entry.type === "task" && entry.task) {
      const s = new Date(entry.task.scheduledStart!).getTime();
      return new Date(s + entry.task.estimatedMinutes * 60000).toISOString();
    }
    return now.toISOString();
  }

  const rendered: React.ReactNode[] = [];

  for (const ad of allDayEntries) {
    if (!ad.event) continue;
    rendered.push(
      <div
        key={ad.event.id}
        className="flex items-start gap-3 p-3 rounded-lg bg-calendar-light/50 border border-calendar-light"
      >
        <div className="w-1 self-stretch rounded-full bg-calendar shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm truncate text-text">
            {ad.event.summary}
          </p>
          <p className="text-xs text-text-muted">All day</p>
        </div>
      </div>
    );
  }

  const nowMs = now.getTime();
  let nowRendered = false;

  function renderNowLine(minutesFree: number | null) {
    return (
      <div key="now" className="space-y-1">
        <div className="flex items-center gap-2 py-1">
          <div className="w-2.5 h-2.5 rounded-full bg-danger shrink-0" />
          <div className="flex-1 h-px bg-danger" />
          <span className="text-xs font-semibold text-danger whitespace-nowrap">
            {formatTime(now.toISOString())}
          </span>
        </div>
        {minutesFree !== null && minutesFree > 0 && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setDragOverId("now-gap");
            }}
            onDragLeave={() => setDragOverId(null)}
            onDrop={(e) => {
              const dropTime = new Date(nowMs + 5 * 60000);
              dropTime.setSeconds(0, 0);
              handleDrop(dropTime.toISOString(), e);
            }}
            className={`border-2 border-dashed rounded-lg text-center text-xs py-2.5 transition-all ${
              dragOverId === "now-gap"
                ? "border-primary bg-primary-light/50 text-primary font-semibold"
                : "border-success/40 bg-success-light/30 text-success font-medium"
            }`}
          >
            {dragOverId === "now-gap" ? "Drop here" : `${minutesFree} min free`}
          </div>
        )}
      </div>
    );
  }

  for (let i = 0; i < timedEntries.length; i++) {
    const entry = timedEntries[i];

    if (!nowRendered && nowMs < entry.time) {
      nowRendered = true;
      const minutesFree = Math.round((entry.time - nowMs) / 60000);
      rendered.push(renderNowLine(minutesFree > 0 ? minutesFree : null));
    }

    if (entry.type === "event" && entry.event) {
      const ev = entry.event;
      const evStartMs = new Date(ev.start).getTime();
      const evEndMs = new Date(ev.end).getTime();
      const isInProgress = !nowRendered && nowMs >= evStartMs && nowMs <= evEndMs;

      if (isInProgress) nowRendered = true;

      const progressPct = isInProgress
        ? ((nowMs - evStartMs) / (evEndMs - evStartMs)) * 100
        : 0;
      const remainingMin = isInProgress
        ? Math.round((evEndMs - nowMs) / 60000)
        : 0;

      const past = isPast(ev.end);
      const overlapping = todayPinned.filter(
        (t) => t.scheduledStart === ev.start
      );

      const durationMin = (evEndMs - evStartMs) / 60000;
      const minHeight = isInProgress
        ? Math.max(80, Math.min(200, durationMin * 2))
        : undefined;

      rendered.push(
        <div
          key={ev.id}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            setDragOverId(`ev-${ev.id}`);
          }}
          onDragLeave={() => setDragOverId(null)}
          onDrop={(e) => handleDrop(ev.start, e)}
          className={`rounded-lg border p-3 transition-all ${
            isInProgress ? "relative" : ""
          } ${
            dragOverId === `ev-${ev.id}`
              ? "border-primary bg-primary-light/50 ring-2 ring-primary/30"
              : past
              ? "bg-border/30 border-border opacity-50"
              : isInProgress
              ? "bg-calendar-light/50 border-calendar ring-1 ring-calendar/30"
              : "bg-calendar-light/50 border-calendar-light"
          }`}
          style={minHeight ? { minHeight: `${minHeight}px` } : undefined}
        >
          {isInProgress && (
            <div
              className="absolute left-0 right-0 flex items-center gap-1 pointer-events-none z-10 px-1"
              style={{ top: `${progressPct}%`, transform: "translateY(-50%)" }}
            >
              <div className="w-2.5 h-2.5 rounded-full bg-danger shrink-0" />
              <div className="flex-1 h-px bg-danger" />
              <span className="text-xs font-semibold text-danger whitespace-nowrap bg-card/80 px-1 rounded">
                {formatTime(now.toISOString())}
              </span>
            </div>
          )}
          <div className="flex items-start gap-3">
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
                {ev.summary}
              </p>
              <p className="text-xs text-text-muted">
                {formatTime(ev.start)} - {formatTime(ev.end)}
                <span className="ml-2 opacity-70">{eventDuration(ev)}</span>
              </p>
              {isInProgress && (
                <p className="text-xs text-calendar font-medium mt-1">
                  {remainingMin} min remaining
                </p>
              )}
              {dragOverId === `ev-${ev.id}` && (
                <p className="text-xs text-primary font-medium mt-1">
                  Drop to double-book during this event
                </p>
              )}
              {overlapping.length > 0 && (
                <div className="mt-2 space-y-1">
                  {overlapping.map((t) => (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/task-id", t.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      className="flex items-center gap-2 px-2 py-1 rounded bg-primary-light/70 border border-primary/20 cursor-grab active:cursor-grabbing"
                    >
                      <div className="w-1 h-4 rounded-full bg-primary shrink-0" />
                      <span className="text-xs font-medium text-primary truncate">
                        {t.title}
                      </span>
                      <span className="text-xs text-text-muted ml-auto shrink-0">
                        {t.estimatedMinutes}m
                      </span>
                      {onScheduleTask && (
                        <button
                          onClick={() => onScheduleTask(t.id, null)}
                          className="text-xs text-text-muted hover:text-danger shrink-0"
                          title="Unschedule"
                        >
                          &times;
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (entry.type === "task" && entry.task) {
      const t = entry.task;
      const taskEnd = new Date(
        new Date(t.scheduledStart!).getTime() + t.estimatedMinutes * 60000
      );
      const past = taskEnd < now;
      rendered.push(
        <div
          key={t.id}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData("text/task-id", t.id);
            e.dataTransfer.effectAllowed = "move";
          }}
          className={`flex items-center gap-3 p-3 rounded-lg border cursor-grab active:cursor-grabbing ${
            past
              ? "bg-border/30 border-border opacity-50"
              : "bg-primary-light/50 border-primary/20"
          }`}
        >
          <div className="w-1 self-stretch rounded-full bg-primary shrink-0" />
          <div className="min-w-0 flex-1">
            <p
              className={`font-medium text-sm truncate ${
                past ? "text-text-muted line-through" : "text-text"
              }`}
            >
              {t.title}
            </p>
            <p className="text-xs text-text-muted">
              {formatTime(t.scheduledStart!)}
              <span className="ml-2 opacity-70">{t.estimatedMinutes} min</span>
            </p>
          </div>
          {onScheduleTask && (
            <button
              onClick={() => onScheduleTask(t.id, null)}
              className="text-xs text-text-muted hover:text-danger shrink-0 p-1"
              title="Unschedule"
            >
              &times;
            </button>
          )}
        </div>
      );
    }

    const next = timedEntries[i + 1];
    if (next) {
      const currentEnd = getEndTime(entry);
      const nextStart =
        next.type === "event"
          ? next.event!.start
          : next.task!.scheduledStart!;

      const gapMs =
        new Date(nextStart).getTime() - new Date(currentEnd).getTime();
      if (gapMs > 15 * 60000) {
        const gapMin = Math.round(gapMs / 60000);
        const dropTime = midpoint(currentEnd, nextStart);
        rendered.push(
          renderDropZone(
            dropTime,
            `${gapMin} min free`,
            `gap-${i}`
          )
        );
      }
    }
  }

  if (!nowRendered) {
    rendered.push(renderNowLine(null));
  }

  const lastTimed = timedEntries[timedEntries.length - 1];
  if (lastTimed) {
    const lastEnd = getEndTime(lastTimed);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 0, 0);
    const gapMs = endOfDay.getTime() - new Date(lastEnd).getTime();
    if (gapMs > 15 * 60000) {
      const afterLast = new Date(
        new Date(lastEnd).getTime() + 15 * 60000
      );
      afterLast.setSeconds(0, 0);
      rendered.push(
        renderDropZone(
          afterLast.toISOString(),
          `After ${formatTime(lastEnd)}`,
          "after-last"
        )
      );
    }
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-3">
        Today&apos;s Schedule
        <span className="ml-2 text-xs font-normal opacity-70">
          drag tasks here
        </span>
      </h2>
      {rendered.length === 0 ? (
        <p className="text-sm text-text-muted">No events today.</p>
      ) : (
        <div className="space-y-2">{rendered}</div>
      )}
    </div>
  );
}
