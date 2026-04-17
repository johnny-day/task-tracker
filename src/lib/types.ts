export interface Task {
  id: string;
  title: string;
  estimatedMinutes: number;
  priority: number;
  status: string;
  category: string;
  calendarEventId: string | null;
  scheduledStart: string | null;
  sortOrder: number;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FitnessLog {
  id: string;
  date: string;
  activeCalories: number;
  updatedAt: string;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  allDay: boolean;
}

export interface Settings {
  id: string;
  wakeTime: string;
  sleepTime: string;
  calorieGoal: number;
  calBurnRate: number;
  burnRateOnboardingDone: boolean;
  /** IANA zone: same calendar day as Shortcut when it only sends activeCalories. */
  fitnessTimeZone: string | null;
}

export interface CompletionEstimate {
  estimatedDoneTime: string | null;
  totalTaskMinutes: number;
  freeMinutes: number;
  exerciseMinutes: number;
  calendarMinutes: number;
  overflow: boolean;
}

export type TaskStatus = "pending" | "in_progress" | "done";
export type Priority = 1 | 2 | 3;

export const PRIORITY_LABELS: Record<number, string> = {
  1: "High",
  2: "Medium",
  3: "Low",
};

export const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  done: "Done",
};
