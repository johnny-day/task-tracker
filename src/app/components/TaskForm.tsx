"use client";

import { useState } from "react";
import { PRIORITY_LABELS } from "@/lib/types";

interface TaskFormProps {
  onSubmit: (task: {
    title: string;
    estimatedMinutes: number;
    priority: number;
    category: string;
    calendarEventId: string | null;
  }) => void;
  calendarEvents?: { id: string; summary: string }[];
  initialValues?: {
    title: string;
    estimatedMinutes: number;
    priority: number;
    category: string;
    calendarEventId: string | null;
  };
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
  const [priority, setPriority] = useState(initialValues?.priority ?? 2);
  const [category, setCategory] = useState(initialValues?.category ?? "general");
  const [calEventId, setCalEventId] = useState<string | null>(
    initialValues?.calendarEventId ?? null
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      estimatedMinutes: minutes,
      priority,
      category,
      calendarEventId: calEventId || null,
    });
    if (!initialValues) {
      setTitle("");
      setMinutes(30);
      setPriority(2);
      setCategory("general");
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
        <div className="flex-1 min-w-[120px]">
          <label className="block text-xs text-text-muted mb-1">Priority</label>
          <select
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
            className="w-full px-3 py-1.5 rounded-lg border border-border bg-card text-text focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {Object.entries(PRIORITY_LABELS).map(([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[120px]">
          <label className="block text-xs text-text-muted mb-1">Category</label>
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="general"
            className="w-full px-3 py-1.5 rounded-lg border border-border bg-card text-text focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>
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
