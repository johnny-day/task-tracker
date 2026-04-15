"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarEvent, CompletionEstimate as EstimateType, Task } from "@/lib/types";
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

  const scheduledTasks = tasks.filter((t) => t.calendarEventId);
  const unscheduledTasks = tasks.filter((t) => !t.calendarEventId);

  function computeDoneByTime() {
    const now = new Date();

    let remainingMeetingMinutes = 0;
    for (const event of calendar.events) {
      if (event.allDay) continue;
      const end = new Date(event.end);
      if (end > now) {
        const start = new Date(event.start);
        const effectiveStart = start > now ? start : now;
        remainingMeetingMinutes += Math.round(
          (end.getTime() - effectiveStart.getTime()) / 60000
        );
      }
    }

    const exerciseMinutes = fitness?.exerciseMinutesLeft ?? 0;

    let taskMinutes = 0;
    for (const t of unscheduledTasks) {
      if (t.status !== "done") taskMinutes += t.estimatedMinutes;
    }

    const totalMinutes =
      remainingMeetingMinutes + exerciseMinutes + taskMinutes;

    const doneBy = new Date(now.getTime() + totalMinutes * 60000);
    const timeStr = doneBy.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });

    return { timeStr, totalMinutes, remainingMeetingMinutes, exerciseMinutes, taskMinutes };
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
            <p className="text-5xl font-bold text-primary mb-3">
              {doneBy.timeStr}
            </p>
            <div className="flex items-center justify-center gap-4 text-sm text-text-muted">
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
        {/* Left: Calendar */}
        <div className="space-y-4">
          <CalendarTimeline
            events={calendar.events}
            connected={calendar.connected}
          />
          {scheduledTasks.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-3">
                Scheduled Tasks
              </h2>
              <div className="space-y-2">
                {scheduledTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onStatusChange={updateTaskStatus}
                    onDelete={deleteTask}
                    onEdit={setEditingTask}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Center: Unscheduled Tasks */}
        <div className="lg:col-span-1">
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-3">
              Unscheduled Tasks
              <span className="ml-2 text-xs font-normal">
                ({unscheduledTasks.filter((t) => t.status !== "done").length})
              </span>
            </h2>
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
