"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { CalendarEvent, Task } from "@/lib/types";
import {
  createEmptyEstimateDayLog,
  createStartedDayLog,
  loadDayLog,
  localDateKey,
  makeSnapshotFromDoneBy,
  saveDayLog,
  shouldAppendSnapshot,
  type EstimateDayLog,
} from "@/lib/estimateSnapshotStorage";
import TaskForm from "./components/TaskForm";
import TaskCard from "./components/TaskCard";
import FitnessWidget from "./components/FitnessWidget";
import CalendarTimeline from "./components/CalendarTimeline";
import EstimateSnapshotTimeline from "./components/EstimateSnapshotTimeline";
import StartMyDayUrlSync from "./components/StartMyDayUrlSync";
import { START_MY_DAY_EVENT } from "./components/StartMyDayNavButton";
import { exerciseMinutesFromBurnProgress } from "@/lib/fitnessExerciseMinutes";

function pickFiniteNumber(record: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const v = record[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "") {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return NaN;
}

interface FitnessData {
  activeCalories: number;
  calorieGoal: number;
  calBurnRate: number;
  remaining: number;
  exerciseMinutesLeft: number;
  shortcutDataStale?: boolean;
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

function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [fitness, setFitness] = useState<FitnessData | null>(null);
  /** Used when `/api/fitness` has not loaded yet so exercise minutes are not stuck at 0. */
  const [fitnessMeta, setFitnessMeta] = useState<{
    calorieGoal: number;
    calBurnRate: number;
  } | null>(null);
  const [calendar, setCalendar] = useState<CalendarData>({
    events: [],
    connected: false,
  });
  const [hiddenEvents, setHiddenEvents] = useState<
    { eventId: string; summary: string }[]
  >([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [completedToday, setCompletedToday] = useState<Task[]>([]);
  const [compactHero, setCompactHero] = useState(false);
  const scrollSentinelRef = useRef<HTMLDivElement>(null);
  const [dayLog, setDayLog] = useState<EstimateDayLog>(createEmptyEstimateDayLog);
  /** Bumps once per minute so passive “now” can move the done-by estimate without a task edit. */
  const [clockTick, setClockTick] = useState(0);
  const handleStartMyDayRef = useRef<(() => void) | null>(null);

  const loadHiddenEvents = useCallback(async () => {
    const res = await fetch("/api/hidden-events");
    setHiddenEvents(await res.json());
  }, []);

  const loadTasks = useCallback(async () => {
    const res = await fetch("/api/tasks?status=pending&status=in_progress");
    const data = await res.json();
    setTasks(Array.isArray(data) ? data : []);
  }, []);

  const loadCompletedToday = useCallback(async () => {
    const now = new Date();
    const start = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0
    );
    const end = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999
    );
    const params = new URLSearchParams({
      status: "done",
      updatedAfter: start.toISOString(),
      updatedBefore: end.toISOString(),
    });
    const res = await fetch(`/api/tasks?${params}`);
    const data = await res.json();
    setCompletedToday(Array.isArray(data) ? data : []);
  }, []);

  const loadFitness = useCallback(async () => {
    const localDate = new Date();
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    /** Same calendar date rule as Shortcut POST when it uses `timezone` + en-CA. */
    const dateStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const startOfDay = new Date(
      localDate.getFullYear(),
      localDate.getMonth(),
      localDate.getDate(),
      0,
      0,
      0,
      0
    );
    const dayStart = startOfDay.toISOString();
    const fitnessDebug =
      typeof window !== "undefined" &&
      window.localStorage.getItem("FITNESS_DEBUG") === "1";
    const cb =
      typeof process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA === "string" &&
      process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA.length >= 7
        ? process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA.slice(0, 7)
        : "";
    const res = await fetch(
      `/api/fitness?date=${encodeURIComponent(dateStr)}&dayStart=${encodeURIComponent(dayStart)}&tz=${encodeURIComponent(tz)}${fitnessDebug ? "&debug=1" : ""}${cb ? `&cb=${encodeURIComponent(cb)}` : ""}`,
      { cache: "no-store" }
    );
    if (!res.ok) {
      setFitness(null);
      return;
    }
    const data: unknown = await res.json();
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      setFitness(null);
      return;
    }
    const o = data as Record<string, unknown>;
    if (o._debug && typeof o._debug === "object") {
      console.info("[fitness debug]", o._debug);
    }
    if (typeof o.error === "string") {
      setFitness(null);
      return;
    }
    const calorieGoal = pickFiniteNumber(o, ["calorieGoal", "calorie_goal"]);
    const activeCalories = pickFiniteNumber(o, ["activeCalories", "active_calories"]);
    const calBurnRateNum = pickFiniteNumber(o, ["calBurnRate", "cal_burn_rate"]);
    if (!Number.isFinite(calorieGoal) || !Number.isFinite(activeCalories)) {
      setFitness(null);
      return;
    }
    const calBurn =
      Number.isFinite(calBurnRateNum) && calBurnRateNum > 0 ? calBurnRateNum : 4;
    const stale = o.shortcutDataStale === true;
    /** Always derive from goal − displayed burn so exercise minutes match the bar (ignore flaky `remaining` in JSON). */
    const remaining = Math.max(0, calorieGoal - activeCalories);
    const exerciseMinutesLeft = exerciseMinutesFromBurnProgress(
      calorieGoal,
      activeCalories,
      calBurn
    );
    setFitness({
      activeCalories,
      calorieGoal,
      calBurnRate: calBurn,
      remaining,
      exerciseMinutesLeft,
      shortcutDataStale: stale,
    });
  }, []);

  const loadCalendar = useCallback(async () => {
    const res = await fetch("/api/calendar");
    setCalendar(await res.json());
  }, []);


  useEffect(() => {
    loadTasks();
    loadFitness();
    loadCalendar();
    loadHiddenEvents();
    loadCompletedToday();
  }, [
    loadTasks,
    loadFitness,
    loadCalendar,
    loadHiddenEvents,
    loadCompletedToday,
  ]);

  useEffect(() => {
    let cancelled = false;
    let timeoutId = 0;

    function msUntilNextLocalMidnight() {
      const now = new Date();
      const next = new Date(now);
      next.setDate(next.getDate() + 1);
      next.setHours(0, 0, 0, 0);
      return Math.max(1000, next.getTime() - now.getTime());
    }

    function scheduleMidnightRefresh() {
      timeoutId = window.setTimeout(() => {
        if (!cancelled) {
          loadFitness();
          setDayLog(loadDayLog(localDateKey()));
          scheduleMidnightRefresh();
        }
      }, msUntilNextLocalMidnight());
    }

    scheduleMidnightRefresh();

    function onVisible() {
      if (document.visibilityState === "visible") {
        loadFitness();
        setDayLog(loadDayLog(localDateKey()));
      }
    }
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [loadFitness]);

  useEffect(() => {
    setDayLog(loadDayLog(localDateKey()));
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/settings", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const s = (await res.json()) as Record<string, unknown>;
        const g = pickFiniteNumber(s, ["calorieGoal", "calorie_goal"]);
        const r = pickFiniteNumber(s, ["calBurnRate", "cal_burn_rate"]);
        if (!Number.isFinite(g) || cancelled) return;
        setFitnessMeta({
          calorieGoal: g,
          calBurnRate: Number.isFinite(r) && r > 0 ? r : 4,
        });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      setClockTick((n) => n + 1);
    }, 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const onEvt = () => {
      handleStartMyDayRef.current?.();
    };
    window.addEventListener(START_MY_DAY_EVENT, onEvt);
    return () => window.removeEventListener(START_MY_DAY_EVENT, onEvt);
  }, []);

  useEffect(() => {
    if (!dayLog.startedAt) return;
    setDayLog((prev) => {
      if (!prev.startedAt) return prev;
      const snap = makeSnapshotFromDoneBy(computeDoneByTime());
      const last = prev.snapshots[prev.snapshots.length - 1];
      if (!shouldAppendSnapshot(last, snap)) return prev;
      const next = {
        ...prev,
        snapshots: [...prev.snapshots, snap],
      };
      saveDayLog(localDateKey(), next);
      return next;
    });
  }, [
    tasks,
    fitness,
    fitnessMeta,
    calendar.events,
    hiddenEvents,
    clockTick,
    dayLog.startedAt,
    dayLog.snapshots.length,
  ]);

  useEffect(() => {
    const el = scrollSentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting && window.scrollY < 80) {
          setCompactHero(false);
        } else {
          setCompactHero(!entry.isIntersecting);
        }
      },
      { root: null, threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);


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
    loadCompletedToday();
  }

  async function updateTaskStatus(id: string, status: string) {
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    loadTasks();
    loadCompletedToday();
  }

  async function deleteTask(id: string) {
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    loadTasks();
    loadCompletedToday();
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
    loadCompletedToday();
  }

  async function updateMinutes(id: string, minutes: number) {
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estimatedMinutes: minutes }),
    });
    loadTasks();
    loadCompletedToday();
  }

  async function scheduleTask(taskId: string, scheduledStart: string | null) {
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledStart }),
    });
    loadTasks();
    loadCompletedToday();
  }

  const hiddenIds = new Set(hiddenEvents.map((h) => h.eventId));
  const visibleEvents = calendar.events.filter((e) => !hiddenIds.has(e.id));

  async function hideEvent(eventId: string, summary: string) {
    setHiddenEvents((prev) => [...prev, { eventId, summary }]);
    await fetch("/api/hidden-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, summary }),
    });
  }

  async function restoreEvent(eventId: string) {
    setHiddenEvents((prev) => prev.filter((h) => h.eventId !== eventId));
    await fetch("/api/hidden-events", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId }),
    });
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

    const todayEvents = visibleEvents.filter(
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

    const exerciseMinutes =
      fitness != null
        ? exerciseMinutesFromBurnProgress(
            fitness.calorieGoal,
            fitness.activeCalories,
            fitness.calBurnRate ?? 4
          )
        : fitnessMeta != null
          ? exerciseMinutesFromBurnProgress(
              fitnessMeta.calorieGoal,
              0,
              fitnessMeta.calBurnRate
            )
          : 0;

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

    let totalFreeMinutes = 0;
    for (const w of freeWindows) {
      totalFreeMinutes += Math.round((w.end - w.start) / 60000);
    }

    const workMinutes = taskMinutes + exerciseMinutes;
    let minutesLeft = workMinutes;
    let workDoneAtMs: number | null = null;

    for (const window of freeWindows) {
      const windowMin = Math.round((window.end - window.start) / 60000);
      if (minutesLeft <= windowMin) {
        workDoneAtMs = window.start + minutesLeft * 60000;
        break;
      }
      minutesLeft -= windowMin;
    }

    let lastEventEndMs = nowMs;
    for (const b of occupiedBlocks) {
      if (b.end > lastEventEndMs) lastEventEndMs = b.end;
    }

    const hasRemainingEvents = lastEventEndMs > nowMs;

    const doneAtMs =
      workDoneAtMs !== null
        ? Math.max(workDoneAtMs, lastEventEndMs)
        : hasRemainingEvents
        ? lastEventEndMs
        : null;

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
      doneAtMs,
      totalMinutes: Math.max(0, totalMinutes),
      remainingMeetingMinutes,
      exerciseMinutes,
      taskMinutes,
      doubleBookedMinutes,
      hasRemainingEvents,
      freeMinutes: totalFreeMinutes,
      overflow: doneAtMs === null && workMinutes > 0,
    };
  }

  const doneBy = computeDoneByTime();

  function handleStartMyDay() {
    const by = computeDoneByTime();
    const next = createStartedDayLog(makeSnapshotFromDoneBy(by));
    saveDayLog(localDateKey(), next);
    setDayLog(next);
  }

  handleStartMyDayRef.current = handleStartMyDay;

  return (
    <div className="space-y-6">
      {/* Hero: Estimated Done Time (sticky; compacts when scrolled) */}
      <div
        className={`sticky top-0 z-20 bg-card/95 backdrop-blur-sm border-b border-border shadow-sm text-center transition-[padding] duration-200 ${
          compactHero ? "py-2 px-2" : "py-8 px-4 rounded-lg border border-border"
        }`}
      >
        {doneBy.totalMinutes === 0 && !doneBy.hasRemainingEvents ? (
          <p
            className={`font-black text-success uppercase tracking-tight ${
              compactHero ? "text-xl" : "text-4xl"
            }`}
          >
            You&apos;re done for the day!
          </p>
        ) : (
          <>
            <p
              className={`text-text-muted uppercase tracking-widest font-semibold ${
                compactHero ? "text-[10px] mb-0.5" : "text-xs mb-2"
              }`}
            >
              Estimated done by
            </p>
            {doneBy.timeStr ? (
              <p
                className={`font-black text-primary tracking-tight ${
                  compactHero ? "text-2xl mb-1" : "text-6xl mb-4"
                }`}
              >
                {doneBy.timeStr}
              </p>
            ) : (
              <p
                className={`font-black text-danger uppercase tracking-tight ${
                  compactHero ? "text-lg mb-1" : "text-3xl mb-4"
                }`}
              >
                Not enough time today
              </p>
            )}
            <div
              className={`flex items-center justify-center text-text-muted flex-wrap ${
                compactHero ? "gap-x-2 gap-y-0.5 text-[10px]" : "gap-5 text-sm"
              }`}
            >
              <span>
                <span
                  className={`font-bold text-calendar ${
                    compactHero ? "" : "text-base"
                  }`}
                >
                  {doneBy.remainingMeetingMinutes}
                </span>{" "}
                min meetings
              </span>
              <span className="text-border">|</span>
              <span>
                <span
                  className={`font-bold text-fitness ${
                    compactHero ? "" : "text-base"
                  }`}
                >
                  {doneBy.exerciseMinutes}
                </span>{" "}
                min exercise
              </span>
              <span className="text-border">|</span>
              <span>
                <span
                  className={`font-bold text-primary ${
                    compactHero ? "" : "text-base"
                  }`}
                >
                  {doneBy.taskMinutes}
                </span>{" "}
                min tasks
              </span>
              {doneBy.doubleBookedMinutes > 0 && (
                <>
                  <span className="text-border">|</span>
                  <span>
                    <span
                      className={`font-bold text-success ${
                        compactHero ? "" : "text-base"
                      }`}
                    >
                      -{doneBy.doubleBookedMinutes}
                    </span>{" "}
                    min overlap
                  </span>
                </>
              )}
            </div>
          </>
        )}
        <div
          className={`mt-3 border-t border-border/60 w-full max-w-lg mx-auto flex flex-col items-center gap-1 ${
            compactHero ? "pt-2 px-1" : "pt-4 px-2"
          }`}
        >
          <button
            type="button"
            onClick={handleStartMyDay}
            className={`w-full font-bold uppercase tracking-wide rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors shadow-md ${
              compactHero ? "py-2 text-[11px]" : "py-3 text-xs sm:text-sm"
            }`}
          >
            Start my day — save today&apos;s timeline
          </button>
          {typeof process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA === "string" &&
            process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA.length >= 7 && (
              <span className="text-[10px] text-text-muted tabular-nums">
                Build {process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA.slice(0, 7)}
              </span>
            )}
        </div>
      </div>

      <div ref={scrollSentinelRef} className="h-px w-full shrink-0" aria-hidden />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text">
          {new Date().toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </h1>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleStartMyDay}
            className="px-4 py-2 border-2 border-primary text-primary rounded-lg hover:bg-primary-light transition-colors font-medium text-sm"
          >
            Start my day
          </button>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors font-medium text-sm"
          >
            {showAddForm ? "Cancel" : "+ Add Task"}
          </button>
        </div>
      </div>

      {showAddForm && (
        <div className="bg-card border border-border rounded-lg p-5">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-3">
            New Task
          </h2>
          <TaskForm
            onSubmit={addTask}
            calendarEvents={visibleEvents}
            onCancel={() => setShowAddForm(false)}
          />
        </div>
      )}

      {editingTask && (
        <div className="bg-card border border-border rounded-lg p-5">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-3">
            Edit Task
          </h2>
          <TaskForm
            onSubmit={updateTask}
            calendarEvents={visibleEvents}
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
            events={visibleEvents}
            connected={calendar.connected}
            pinnedTasks={pinnedTasks}
            onScheduleTask={scheduleTask}
            onHideEvent={hideEvent}
          />
          {scheduledTasks.length > 0 && (
            <div className="bg-card border border-border rounded-lg p-5">
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
          {hiddenEvents.length > 0 && (
            <details className="bg-card border border-border rounded-lg p-4">
              <summary className="text-xs font-semibold text-text-muted uppercase tracking-wide cursor-pointer select-none">
                Hidden events ({hiddenEvents.length})
              </summary>
              <div className="mt-2 space-y-1">
                {hiddenEvents.map((h) => (
                  <div
                    key={h.eventId}
                    className="flex items-center justify-between gap-2 px-2 py-1.5 rounded bg-border/30 text-xs"
                  >
                    <span className="text-text-muted truncate">
                      {h.summary || "(No title)"}
                    </span>
                    <button
                      onClick={() => restoreEvent(h.eventId)}
                      className="text-primary hover:underline shrink-0 font-medium"
                    >
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>

        {/* Center: Unscheduled Tasks (drag source) */}
        <div className="lg:col-span-1">
          <div
            className="bg-card border border-border rounded-lg p-5"
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
              calBurnRate={fitness.calBurnRate ?? 4}
              remaining={fitness.remaining}
              exerciseMinutesLeft={fitness.exerciseMinutesLeft}
              shortcutDataStale={fitness.shortcutDataStale}
            />
          )}
          <div className="bg-card border border-border rounded-lg p-5">
            <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-3">
              Completion Estimate
            </h2>
            {doneBy.totalMinutes === 0 && !doneBy.hasRemainingEvents ? (
              <p className="text-success font-medium">
                All tasks done! You&apos;re free.
              </p>
            ) : (
              <>
                <div className="mb-3">
                  {doneBy.timeStr ? (
                    <p className="text-2xl font-bold text-text">
                      Done by{" "}
                      <span className="text-primary">{doneBy.timeStr}</span>
                    </p>
                  ) : (
                    <p className="text-lg font-semibold text-danger">
                      Not enough time today
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="p-2.5 rounded-lg bg-primary-light border border-primary/20">
                    <p className="text-text-muted text-xs uppercase tracking-wider">Task time</p>
                    <p className="font-bold text-primary text-lg">
                      {doneBy.taskMinutes} <span className="text-xs font-normal text-text-muted">min</span>
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-fitness-light border border-fitness/20">
                    <p className="text-text-muted text-xs uppercase tracking-wider">Exercise</p>
                    <p className="font-bold text-fitness text-lg">
                      {doneBy.exerciseMinutes} <span className="text-xs font-normal text-text-muted">min</span>
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-calendar-light border border-calendar/20">
                    <p className="text-text-muted text-xs uppercase tracking-wider">Calendar</p>
                    <p className="font-bold text-calendar text-lg">
                      {doneBy.remainingMeetingMinutes} <span className="text-xs font-normal text-text-muted">min</span>
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-success-light border border-success/20">
                    <p className="text-text-muted text-xs uppercase tracking-wider">Free time</p>
                    <p className="font-bold text-success text-lg">
                      {doneBy.freeMinutes} <span className="text-xs font-normal text-text-muted">min</span>
                    </p>
                  </div>
                </div>
                {doneBy.overflow && (
                  <p className="mt-3 text-sm text-warning font-medium">
                    Tasks + exercise exceed your free time today. Consider
                    rescheduling.
                  </p>
                )}
              </>
            )}

            <EstimateSnapshotTimeline
              embedded
              dayLog={dayLog}
              onStartMyDay={handleStartMyDay}
            />
          </div>
        </div>
      </div>

      <details className="bg-card border border-border rounded-lg p-4">
        <summary className="text-xs font-semibold text-text-muted uppercase tracking-widest cursor-pointer select-none">
          Completed today ({completedToday.length})
        </summary>
        {completedToday.length === 0 ? (
          <p className="mt-2 text-sm text-text-muted">
            No tasks completed today yet.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {completedToday.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-baseline justify-between gap-2 text-sm border-b border-border/40 pb-2 last:border-0 last:pb-0"
              >
                <span className="font-medium text-text truncate min-w-0">
                  {t.title}
                </span>
                <span className="text-text-muted shrink-0 text-xs tabular-nums">
                  {t.estimatedMinutes} min ·{" "}
                  {new Date(t.updatedAt).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </details>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-6xl mx-auto px-4 py-16 text-center text-text-muted">
          Loading dashboard…
        </div>
      }
    >
      <StartMyDayUrlSync />
      <Dashboard />
    </Suspense>
  );
}
