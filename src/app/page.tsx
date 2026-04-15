"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CalendarEvent,
  CompletionEstimate as EstimateType,
  Task,
} from "@/lib/types";
import TaskForm from "./components/TaskForm";
import TaskCard from "./components/TaskCard";
import FitnessWidget from "./components/FitnessWidget";
import CalendarTimeline from "./components/CalendarTimeline";
import CompletionEstimateWidget from "./components/CompletionEstimate";

interface FitnessData {
  activeCalories: number;
  calorieGoal: number;
  remaining: number;
  exerciseMinutesLeft: number;
}

interface CalendarData {
  events: CalendarEvent[];
  connected: boolean;
}

interface TimeBlock {
  start: number;
  end: number;
}

function isTodayLocal(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function mergeBlocks(blocks: TimeBlock[]): TimeBlock[] {
  if (blocks.length === 0) return [];
  const sorted = [...blocks].sort((a, b) => a.start - b.start);
  const merged: TimeBlock[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    if (sorted[i].start <= last.end) {
      last.end = Math.max(last.end, sorted[i].end);
    } else {
      merged.push(sorted[i]);
    }
  }
  return merged;
}

function blocksOverlap(a: TimeBlock, b: TimeBlock): boolean {
  return a.start < b.end && b.start < a.end;
}

export default function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [fitness, setFitness] = useState<FitnessData | null>(null);
  const [calendar, setCalendar] = useState<CalendarData>({
    events: [],
    connected: false,
  });
  const [estimate, setEstimate] = useState<EstimateType | null>(null);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const loadTasks = useCallback(async () => {
    const res = await fetch("/api/tasks?status=pending&status=in_progress");
    const data = await res.json();
    setTasks(Array.isArray(data) ? data : []);
  }, []);

  const loadFitness = useCallback(async () => {
    const res = await fetch("/api/fitness");
    setFitness(await res.json());
  }, []);

  const loadCalendar = useCallback(async () => {
    const res = await fetch("/api/calendar");
    setCalendar(await res.json());
  }, []);

  const loadEstimate = useCallback(
    async (calEvents: CalendarEvent[]) => {
      setEstimateLoading(true);
      try {
        const res = await fetch("/api/estimate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ calendarEvents: calEvents }),
        });
        setEstimate(await res.json());
      } finally {
        setEstimateLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    loadTasks();
    loadFitness();
    loadCalendar();
  }, [loadTasks, loadFitness, loadCalendar]);

  useEffect(() => {
    if (tasks.length >= 0) {
      loadEstimate(calendar.events);
    }
  }, [tasks, calendar.events, loadEstimate]);

  async function addTask(data: {
    title: string;
    estimatedMinutes: number;
    priority: number;
    category: string;
    calendarEventId: string | null;
  }) {
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setShowAddForm(false);
    loadTasks();
  }

  async function updateTaskStatus(id: string, status: string) {
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    loadTasks();
  }

  async function deleteTask(id: string) {
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    loadTasks();
  }

  async function updateTask(data: {
    title: string;
    estimatedMinutes: number;
    priority: number;
    category: string;
    calendarEventId: string | null;
  }) {
    if (!editingTask) return;
    await fetch(`/api/tasks/${editingTask.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setEditingTask(null);
    loadTasks();
  }

  async function updateMinutes(id: string, minutes: number) {
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estimatedMinutes: minutes }),
    });
    loadTasks();
  }

  async function scheduleTask(taskId: string, scheduledStart: string | null) {
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledStart }),
    });
    loadTasks();
  }

  const pinnedTasks = tasks.filter((t) => t.scheduledStart && t.status !== "done");
  const unscheduledTasks = tasks.filter((t) => !t.scheduledStart && !t.calendarEventId && t.status !== "done");
  const scheduledTasks = tasks.filter((t) => t.calendarEventId && t.status !== "done");

  function computeDoneByTime() {
    const now = new Date();
    const nowMs = now.getTime();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 0, 0);
    const endMs = endOfDay.getTime();

    const todayEvents = calendar.events.filter(
      (e) => !e.allDay && (isTodayLocal(e.start) || isTodayLocal(e.end))
    );
    const calBlocks: TimeBlock[] = todayEvents
      .map((e) => ({
        start: Math.max(new Date(e.start).getTime(), nowMs),
        end: Math.min(new Date(e.end).getTime(), endMs),
      }))
      .filter((b) => b.start < b.end);

    const occupiedBlocks = mergeBlocks(calBlocks);

    let remainingMeetingMinutes = 0;
    for (const b of occupiedBlocks) {
      remainingMeetingMinutes += Math.round((b.end - b.start) / 60000);
    }

    const pinnedBlocks: TimeBlock[] = pinnedTasks
      .map((t) => {
        const s = new Date(t.scheduledStart!).getTime();
        return { start: s, end: s + t.estimatedMinutes * 60000 };
      })
      .filter((b) => b.end > nowMs);

    let doubleBookedMinutes = 0;
    for (const pb of pinnedBlocks) {
      for (const cb of occupiedBlocks) {
        if (blocksOverlap(pb, cb)) {
          const overlapStart = Math.max(pb.start, cb.start);
          const overlapEnd = Math.min(pb.end, cb.end);
          doubleBookedMinutes += Math.round(
            (overlapEnd - overlapStart) / 60000
          );
        }
      }
    }

    let pinnedFreeMinutes = 0;
    for (const pb of pinnedBlocks) {
      let inFree = pb.end - pb.start;
      for (const cb of occupiedBlocks) {
        if (blocksOverlap(pb, cb)) {
          const overlapStart = Math.max(pb.start, cb.start);
          const overlapEnd = Math.min(pb.end, cb.end);
          inFree -= overlapEnd - overlapStart;
        }
      }
      pinnedFreeMinutes += Math.max(0, Math.round(inFree / 60000));
    }

    const exerciseMinutes = fitness?.exerciseMinutesLeft ?? 0;

    let taskMinutes = 0;
    for (const t of unscheduledTasks) {
      taskMinutes += t.estimatedMinutes;
    }

    const allOccupied = mergeBlocks([...occupiedBlocks, ...pinnedBlocks.filter((pb) => {
      for (const cb of occupiedBlocks) {
        if (blocksOverlap(pb, cb)) return false;
      }
      return true;
    })]);

    const freeWindows: TimeBlock[] = [];
    let cursor = nowMs;
    for (const block of allOccupied) {
      if (cursor < block.start) {
        freeWindows.push({ start: cursor, end: block.start });
      }
      cursor = Math.max(cursor, block.end);
    }
    if (cursor < endMs) {
      freeWindows.push({ start: cursor, end: endMs });
    }

    const workMinutes = taskMinutes + exerciseMinutes;
    let minutesLeft = workMinutes;
    let doneAtMs: number | null = null;

    for (const window of freeWindows) {
      const windowMin = Math.round((window.end - window.start) / 60000);
      if (minutesLeft <= windowMin) {
        doneAtMs = window.start + minutesLeft * 60000;
        break;
      }
      minutesLeft -= windowMin;
    }

    const totalMinutes =
      remainingMeetingMinutes + exerciseMinutes + taskMinutes - doubleBookedMinutes;

    const timeStr = doneAtMs
      ? new Date(doneAtMs).toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        })
      : null;

    return {
      timeStr,
      totalMinutes: Math.max(0, totalMinutes),
      remainingMeetingMinutes,
      exerciseMinutes,
      taskMinutes,
      doubleBookedMinutes,
      overflow: doneAtMs === null && workMinutes > 0,
    };
  }

  const doneBy = computeDoneByTime();

  return (
    <div className="space-y-6">
      {/* Hero: Estimated Done Time */}
      <div className="bg-card border border-border rounded-xl p-6 text-center">
        {doneBy.totalMinutes === 0 ? (
          <p className="text-3xl font-bold text-success">
            You&apos;re done for the day!
          </p>
        ) : (
          <>
            <p className="text-sm text-text-muted uppercase tracking-wide mb-1">
              Estimated done by
            </p>
            {doneBy.timeStr ? (
              <p className="text-5xl font-bold text-primary mb-3">
                {doneBy.timeStr}
              </p>
            ) : (
              <p className="text-2xl font-bold text-danger mb-3">
                Not enough time today
              </p>
            )}
            <div className="flex items-center justify-center gap-4 text-sm text-text-muted flex-wrap">
              <span>
                <span className="font-semibold text-calendar">
                  {doneBy.remainingMeetingMinutes}
                </span>{" "}
                min meetings
              </span>
              <span className="text-border">|</span>
              <span>
                <span className="font-semibold text-fitness">
                  {doneBy.exerciseMinutes}
                </span>{" "}
                min exercise
              </span>
              <span className="text-border">|</span>
              <span>
                <span className="font-semibold text-primary">
                  {doneBy.taskMinutes}
                </span>{" "}
                min tasks
              </span>
              {doneBy.doubleBookedMinutes > 0 && (
                <>
                  <span className="text-border">|</span>
                  <span>
                    <span className="font-semibold text-success">
                      -{doneBy.doubleBookedMinutes}
                    </span>{" "}
                    min overlap
                  </span>
                </>
              )}
            </div>
          </>
        )}
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text">
          {new Date().toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </h1>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors font-medium text-sm"
        >
          {showAddForm ? "Cancel" : "+ Add Task"}
        </button>
      </div>

      {showAddForm && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-3">
            New Task
          </h2>
          <TaskForm
            onSubmit={addTask}
            calendarEvents={calendar.events}
            onCancel={() => setShowAddForm(false)}
          />
        </div>
      )}

      {editingTask && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-3">
            Edit Task
          </h2>
          <TaskForm
            onSubmit={updateTask}
            calendarEvents={calendar.events}
            initialValues={editingTask}
            submitLabel="Save Changes"
            onCancel={() => setEditingTask(null)}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Calendar Timeline (drop target) */}
        <div className="space-y-4">
          <CalendarTimeline
            events={calendar.events}
            connected={calendar.connected}
            pinnedTasks={pinnedTasks}
            onScheduleTask={scheduleTask}
          />
          {scheduledTasks.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-3">
                Calendar-Linked Tasks
              </h2>
              <div className="space-y-2">
                {scheduledTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onStatusChange={updateTaskStatus}
                    onDelete={deleteTask}
                    onEdit={setEditingTask}
                    onUpdateMinutes={updateMinutes}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Center: Unscheduled Tasks (drag source) */}
        <div className="lg:col-span-1">
          <div
            className="bg-card border border-border rounded-xl p-5"
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }}
            onDrop={(e) => {
              e.preventDefault();
              const taskId = e.dataTransfer.getData("text/task-id");
              if (taskId) scheduleTask(taskId, null);
            }}
          >
            <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-3">
              Unscheduled Tasks
              <span className="ml-2 text-xs font-normal">
                ({unscheduledTasks.length})
              </span>
            </h2>
            <p className="text-xs text-text-muted mb-3">
              Drag tasks to the calendar to schedule them
            </p>
            {unscheduledTasks.length === 0 ? (
              <p className="text-sm text-text-muted">
                No unscheduled tasks. Add one above!
              </p>
            ) : (
              <div className="space-y-2">
                {unscheduledTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onStatusChange={updateTaskStatus}
                    onDelete={deleteTask}
                    onEdit={setEditingTask}
                    onUpdateMinutes={updateMinutes}
                    draggable
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Fitness + Estimate */}
        <div className="space-y-4">
          {fitness && (
            <FitnessWidget
              activeCalories={fitness.activeCalories}
              calorieGoal={fitness.calorieGoal}
              remaining={fitness.remaining}
              exerciseMinutesLeft={fitness.exerciseMinutesLeft}
            />
          )}
          <CompletionEstimateWidget
            estimate={estimate}
            loading={estimateLoading}
          />
        </div>
      </div>
    </div>
  );
}
