import { CalendarEvent, Settings } from "./types";
import { categorySortRank } from "./taskCategories";

interface EstimateTask {
  estimatedMinutes: number;
  category: string;
  status: string;
  calendarEventId: string | null;
  sortOrder: number;
}

interface TimeBlock {
  start: number;
  end: number;
}

function parseTime(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTimeString(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h >= 12 ? "PM" : "AM";
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayH}:${m.toString().padStart(2, "0")} ${period}`;
}

function parseISOToMinutes(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
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

export function calculateEstimate(
  tasks: EstimateTask[],
  calendarEvents: CalendarEvent[],
  fitnessCalories: number,
  settings: Settings,
  nowMinutes?: number
) {
  const wake = parseTime(settings.wakeTime);
  const sleep = parseTime(settings.sleepTime);
  const now = nowMinutes ?? new Date().getHours() * 60 + new Date().getMinutes();
  const dayStart = Math.max(wake, now);

  if (dayStart >= sleep) {
    return {
      estimatedDoneTime: null,
      totalTaskMinutes: 0,
      freeMinutes: 0,
      exerciseMinutes: 0,
      calendarMinutes: 0,
      overflow: true,
    };
  }

  const remainingCals = Math.max(0, settings.calorieGoal - fitnessCalories);
  const exerciseMinutes = Math.ceil(remainingCals / settings.calBurnRate);

  const calBlocks: TimeBlock[] = calendarEvents
    .filter((e) => !e.allDay)
    .map((e) => ({
      start: Math.max(parseISOToMinutes(e.start), dayStart),
      end: Math.min(parseISOToMinutes(e.end), sleep),
    }))
    .filter((b) => b.start < b.end);

  const occupiedBlocks = mergeBlocks(calBlocks);

  let calendarMinutes = 0;
  for (const b of occupiedBlocks) {
    calendarMinutes += b.end - b.start;
  }

  const freeWindows: TimeBlock[] = [];
  let cursor = dayStart;
  for (const block of occupiedBlocks) {
    if (cursor < block.start) {
      freeWindows.push({ start: cursor, end: block.start });
    }
    cursor = Math.max(cursor, block.end);
  }
  if (cursor < sleep) {
    freeWindows.push({ start: cursor, end: sleep });
  }

  let totalFreeMinutes = 0;
  for (const w of freeWindows) {
    totalFreeMinutes += w.end - w.start;
  }

  const availableAfterExercise = totalFreeMinutes - exerciseMinutes;

  const pendingTasks = tasks
    .filter((t) => t.status !== "done" && !t.calendarEventId)
    .sort(
      (a, b) =>
        categorySortRank(a.category) - categorySortRank(b.category) ||
        a.sortOrder - b.sortOrder
    );

  let totalTaskMinutes = 0;
  for (const t of pendingTasks) {
    totalTaskMinutes += t.estimatedMinutes;
  }

  const overflow = totalTaskMinutes + exerciseMinutes > totalFreeMinutes;

  let minutesNeeded = totalTaskMinutes + exerciseMinutes;
  let doneAt: number | null = null;

  for (const window of freeWindows) {
    const windowSize = window.end - window.start;
    if (minutesNeeded <= windowSize) {
      doneAt = window.start + minutesNeeded;
      break;
    }
    minutesNeeded -= windowSize;
  }

  return {
    estimatedDoneTime: doneAt !== null ? minutesToTimeString(doneAt) : null,
    totalTaskMinutes,
    freeMinutes: totalFreeMinutes,
    exerciseMinutes,
    calendarMinutes,
    overflow,
  };
}
