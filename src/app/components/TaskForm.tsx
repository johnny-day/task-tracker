"use client";

import { useState } from "react";
import {
  TASK_CATEGORY_LABELS,
  TASK_CATEGORY_ORDER,
  normalizeCategory,
  type TaskCategorySlug,
} from "@/lib/taskCategories";

const WORK_CATEGORIES = TASK_CATEGORY_ORDER.filter(
  (s): s is Exclude<TaskCategorySlug, "longterm"> => s !== "longterm"
);

export interface TaskFormValues {
  title: string;
  estimatedMinutes: number;
  category: string;
  calendarEventId: string | null;
  repeatDaily: boolean;
}

interface TaskFormProps {
  onSubmit: (task: TaskFormValues) => void;
  calendarEvents?: { id: string; summary: string }[];
  initialValues?: TaskFormValues;
  submitLabel?: string;
  onCancel?: () => void;
}

export default function TaskForm({
  onSubmit,
  calendarEvents = [],
  initialValues,
  submitLabel = "Add Task",
  onCancel,
}: TaskFormProps) {
  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [minutes, setMinutes] = useState(initialValues?.estimatedMinutes ?? 30);
  const [isLongTerm, setIsLongTerm] = useState(initialValues?.category === "longterm");
  const [workCategory, setWorkCategory] = useState<Exclude<TaskCategorySlug, "longterm">>(() =>
    initialValues?.category === "longterm"
      ? "misc"
      : (normalizeCategory(initialValues?.category) as Exclude<TaskCategorySlug, "longterm">)
  );
  const [repeatDaily, setRepeatDaily] = useState(initialValues?.repeatDaily ?? false);
  const [calEventId, setCalEventId] = useState<string | null>(
    initialValues?.calendarEventId ?? null
  );

  const category = isLongTerm ? "longterm" : workCategory;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      estimatedMinutes: minutes,
      category,
      calendarEventId: calEventId || null,
      repeatDaily: isLongTerm ? false : repeatDaily,
    });
    if (!initialValues) {
      setTitle("");
      setMinutes(30);
      setIsLongTerm(false);
      setWorkCategory("misc");
      setRepeatDaily(false);
      setCalEventId(null);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Task title..."
          className="w-full px-3 py-2 rounded-lg border border-border bg-card text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>
      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-[120px]">
          <label className="block text-xs text-text-muted mb-1">
            Duration (min)
          </label>
          <input
            type="number"
            value={minutes}
            onChange={(e) => setMinutes(Math.max(1, Number(e.target.value)))}
            min={1}
            className="w-full px-3 py-1.5 rounded-lg border border-border bg-card text-text focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        {!isLongTerm && (
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs text-text-muted mb-1">Category</label>
            <select
              value={workCategory}
              onChange={(e) =>
                setWorkCategory(e.target.value as Exclude<TaskCategorySlug, "longterm">)
              }
              className="w-full px-3 py-1.5 rounded-lg border border-border bg-card text-text focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {WORK_CATEGORIES.map((slug) => (
                <option key={slug} value={slug}>
                  {TASK_CATEGORY_LABELS[slug]}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex items-end min-w-[120px] pb-0.5">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isLongTerm}
              onChange={(e) => setIsLongTerm(e.target.checked)}
              className="accent-primary w-4 h-4"
            />
            <span className="text-sm text-text">Long term</span>
          </label>
        </div>
      </div>
      {!isLongTerm && (
        <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-text">
          <input
            type="checkbox"
            checked={repeatDaily}
            onChange={(e) => setRepeatDaily(e.target.checked)}
            className="accent-primary w-4 h-4"
          />
          Repeats daily (resets to pending the next day after you complete it)
        </label>
      )}
      {calendarEvents.length > 0 && (
        <div>
          <label className="block text-xs text-text-muted mb-1">
            Link to calendar event (optional)
          </label>
          <select
            value={calEventId ?? ""}
            onChange={(e) => setCalEventId(e.target.value || null)}
            className="w-full px-3 py-1.5 rounded-lg border border-border bg-card text-text focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">No calendar event (unscheduled)</option>
            {calendarEvents.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.summary}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors font-medium"
        >
          {submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-border rounded-lg hover:bg-border/50 transition-colors text-text-muted"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
