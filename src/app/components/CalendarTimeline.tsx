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

function isPastTime(iso: string, minutes: number): boolean {
  return new Date(iso).getTime() + minutes * 60000 < Date.now();
}

interface TimelineItem {
  type: "event" | "task" | "now-line";
  sortTime: number;
  event?: CalendarEvent;
  task?: Task;
}

function getHourSlots(): { hour: number; label: string }[] {
  const now = new Date();
  const currentHour = now.getHours();
  const slots: { hour: number; label: string }[] = [];
  for (let h = currentHour; h <= 23; h++) {
    const period = h >= 12 ? "PM" : "AM";
    const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
    slots.push({ hour: h, label: `${display} ${period}` });
  }
  return slots;
}

export default function CalendarTimeline({
  events,
  connected,
  pinnedTasks = [],
  onScheduleTask,
}: CalendarTimelineProps) {
  const [dragOverHour, setDragOverHour] = useState<number | null>(null);
  const [dragOverEventId, setDragOverEventId] = useState<string | null>(null);

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

  const items: TimelineItem[] = [];

  for (const event of todayEvents) {
    items.push({
      type: "event",
      sortTime: event.allDay ? 0 : new Date(event.start).getTime(),
      event,
    });
  }

  for (const task of pinnedTasks) {
    if (task.scheduledStart && isToday(task.scheduledStart)) {
      items.push({
        type: "task",
        sortTime: new Date(task.scheduledStart).getTime(),
        task,
      });
    }
  }

  items.push({ type: "now-line", sortTime: now.getTime() });
  items.sort((a, b) => a.sortTime - b.sortTime);

  const hourSlots = getHourSlots();

  function handleDropOnHour(hour: number, e: React.DragEvent) {
    e.preventDefault();
    setDragOverHour(null);
    const taskId = e.dataTransfer.getData("text/task-id");
    if (!taskId || !onScheduleTask) return;

    const target = new Date();
    target.setHours(hour, 0, 0, 0);
    onScheduleTask(taskId, target.toISOString());
  }

  function handleDropOnEvent(eventId: string, e: React.DragEvent) {
    e.preventDefault();
    setDragOverEventId(null);
    const taskId = e.dataTransfer.getData("text/task-id");
    if (!taskId || !onScheduleTask) return;

    const event = todayEvents.find((ev) => ev.id === eventId);
    if (!event) return;
    onScheduleTask(taskId, event.start);
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-3">
        Today&apos;s Schedule
      </h2>

      {todayEvents.length === 0 && pinnedTasks.length === 0 ? (
        <p className="text-sm text-text-muted mb-3">No events today.</p>
      ) : (
        <div className="space-y-1 mb-4">
          {items.map((item, i) => {
            if (item.type === "now-line") {
              return <NowLine key="now" time={nowTime} />;
            }
            if (item.type === "event" && item.event) {
              const ev = item.event;
              const past = isPast(ev);
              const overlappingTasks = pinnedTasks.filter(
                (t) => t.scheduledStart === ev.start
              );
              return (
                <div
                  key={ev.id}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    setDragOverEventId(ev.id);
                  }}
                  onDragLeave={() => setDragOverEventId(null)}
                  onDrop={(e) => handleDropOnEvent(ev.id, e)}
                  className={`rounded-lg border p-3 transition-all ${
                    dragOverEventId === ev.id
                      ? "border-primary bg-primary-light/50 ring-2 ring-primary/30"
                      : past
                      ? "bg-border/30 border-border opacity-50"
                      : "bg-calendar-light/50 border-calendar-light"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-1 self-stretch rounded-full shrink-0 ${
                        past ? "bg-text-muted" : "bg-calendar"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={`font-medium text-sm truncate ${
                          past
                            ? "text-text-muted line-through"
                            : "text-text"
                        }`}
                      >
                        {ev.summary}
                      </p>
                      <p className="text-xs text-text-muted">
                        {ev.allDay
                          ? "All day"
                          : `${formatTime(ev.start)} - ${formatTime(ev.end)}`}
                        <span className="ml-2 opacity-70">
                          {eventDuration(ev)}
                        </span>
                      </p>
                      {overlappingTasks.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {overlappingTasks.map((t) => (
                            <div
                              key={t.id}
                              className="flex items-center gap-2 px-2 py-1 rounded bg-primary-light/70 border border-primary/20"
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
                                  onClick={() =>
                                    onScheduleTask(t.id, null)
                                  }
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
            if (item.type === "task" && item.task) {
              const t = item.task;
              const overlapsEvent = todayEvents.some(
                (ev) => !ev.allDay && ev.start === t.scheduledStart
              );
              if (overlapsEvent) return null;

              const past = isPastTime(t.scheduledStart!, t.estimatedMinutes);
              return (
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
                      <span className="ml-2 opacity-70">
                        {t.estimatedMinutes} min
                      </span>
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
            return null;
          })}
        </div>
      )}

      {/* Hour slots as drop targets */}
      <div className="border-t border-border pt-3 mt-2">
        <p className="text-xs text-text-muted mb-2">
          Drop a task on an hour to schedule it
        </p>
        <div className="grid grid-cols-4 gap-1">
          {hourSlots.map(({ hour, label }) => (
            <div
              key={hour}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setDragOverHour(hour);
              }}
              onDragLeave={() => setDragOverHour(null)}
              onDrop={(e) => handleDropOnHour(hour, e)}
              className={`text-center text-xs py-2 rounded border transition-all cursor-default ${
                dragOverHour === hour
                  ? "border-primary bg-primary-light text-primary font-semibold"
                  : "border-border text-text-muted hover:border-primary/50"
              }`}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
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
