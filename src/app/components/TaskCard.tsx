"use client";

import { useState } from "react";
import { Task, PRIORITY_LABELS, STATUS_LABELS } from "@/lib/types";

interface TaskCardProps {
  task: Task;
  onStatusChange: (id: string, status: string) => void;
  onDelete: (id: string) => void;
  onEdit: (task: Task) => void;
  onUpdateMinutes?: (id: string, minutes: number) => void;
  draggable?: boolean;
  compact?: boolean;
}

const priorityColors: Record<number, string> = {
  1: "border-l-danger",
  2: "border-l-warning",
  3: "border-l-success",
};

export default function TaskCard({
  task,
  onStatusChange,
  onDelete,
  onEdit,
  onUpdateMinutes,
  draggable: isDraggable,
  compact,
}: TaskCardProps) {
  const isDone = task.status === "done";
  const [editingMinutes, setEditingMinutes] = useState(false);
  const [minutesValue, setMinutesValue] = useState(task.estimatedMinutes);

  function commitMinutes() {
    setEditingMinutes(false);
    const val = Math.max(1, minutesValue);
    if (val !== task.estimatedMinutes && onUpdateMinutes) {
      onUpdateMinutes(task.id, val);
    }
  }

  return (
    <div
      draggable={isDraggable && !editingMinutes}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/task-id", task.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className={`bg-card border border-border rounded-lg ${compact ? "p-2" : "p-4"} border-l-4 ${
        priorityColors[task.priority] || "border-l-border"
      } ${isDone ? "opacity-60" : ""} ${isDraggable && !editingMinutes ? "cursor-grab active:cursor-grabbing" : ""} transition-all`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3
              className={`font-medium truncate ${
                isDone ? "line-through text-text-muted" : "text-text"
              }`}
            >
              {task.title}
            </h3>
            {task.calendarEventId && (
              <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-calendar-light text-calendar font-medium">
                Scheduled
              </span>
            )}
            {task.category === "longterm" && (
              <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-border text-text-muted font-medium">
                Long Term
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-text-muted">
            {editingMinutes ? (
              <span className="flex items-center gap-1">
                <input
                  type="number"
                  value={minutesValue}
                  onChange={(e) => setMinutesValue(Number(e.target.value))}
                  onBlur={commitMinutes}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitMinutes();
                    if (e.key === "Escape") setEditingMinutes(false);
                  }}
                  min={1}
                  autoFocus
                  className="w-14 px-1 py-0.5 rounded border border-primary bg-card text-text text-xs focus:outline-none"
                />
                min
              </span>
            ) : (
              <button
                onClick={() => {
                  setMinutesValue(task.estimatedMinutes);
                  setEditingMinutes(true);
                }}
                className="hover:text-primary hover:underline cursor-pointer"
                title="Click to edit duration"
              >
                {task.estimatedMinutes} min
              </button>
            )}
            <span>{PRIORITY_LABELS[task.priority]}</span>
            <span className="capitalize">{task.category}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <select
            value={task.status}
            onChange={(e) => onStatusChange(task.id, e.target.value)}
            className="text-xs px-2 py-1 rounded border border-border bg-card text-text focus:outline-none"
          >
            {Object.entries(STATUS_LABELS).map(([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </select>
          <button
            onClick={() => onEdit(task)}
            className="p-1.5 rounded hover:bg-border/50 text-text-muted hover:text-text transition-colors"
            title="Edit"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(task.id)}
            className="p-1.5 rounded hover:bg-danger-light text-text-muted hover:text-danger transition-colors"
            title="Delete"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
