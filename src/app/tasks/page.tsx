"use client";

import { useCallback, useEffect, useState } from "react";
import { Task, STATUS_LABELS } from "@/lib/types";
import TaskForm from "../components/TaskForm";
import TaskCard from "../components/TaskCard";

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const loadTasks = useCallback(async () => {
    const url =
      statusFilter === "all"
        ? "/api/tasks"
        : `/api/tasks?status=${statusFilter}`;
    const res = await fetch(url);
    const data = await res.json();
    setTasks(Array.isArray(data) ? data : []);
  }, [statusFilter]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

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

  const totalMinutes = tasks
    .filter((t) => t.status !== "done")
    .reduce((sum, t) => sum + t.estimatedMinutes, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text">All Tasks</h1>
          <p className="text-sm text-text-muted">
            {tasks.length} tasks &middot; {totalMinutes} min remaining
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-sm rounded-lg border border-border bg-card text-text"
          >
            <option value="all">All Statuses</option>
            {Object.entries(STATUS_LABELS).map(([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              setShowAddForm(!showAddForm);
              setEditingTask(null);
            }}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors font-medium text-sm"
          >
            {showAddForm ? "Cancel" : "+ Add Task"}
          </button>
        </div>
      </div>

      {showAddForm && (
        <div className="bg-card border border-border rounded-xl p-5">
          <TaskForm onSubmit={addTask} onCancel={() => setShowAddForm(false)} />
        </div>
      )}

      {editingTask && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-3">
            Edit Task
          </h2>
          <TaskForm
            onSubmit={updateTask}
            initialValues={editingTask}
            submitLabel="Save Changes"
            onCancel={() => setEditingTask(null)}
          />
        </div>
      )}

      {tasks.length === 0 ? (
        <div className="text-center py-12 text-text-muted">
          <p className="text-lg">No tasks yet.</p>
          <p className="text-sm">Click &quot;+ Add Task&quot; to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onStatusChange={updateTaskStatus}
              onDelete={deleteTask}
              onEdit={(t) => {
                setEditingTask(t);
                setShowAddForm(false);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
