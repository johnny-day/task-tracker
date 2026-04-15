"use client";

import { useCallback, useEffect, useState } from "react";
import { signIn, signOut } from "next-auth/react";
import { Settings } from "@/lib/types";

interface MaskedApiKey {
  id: string;
  key: string;
  label: string;
  createdAt: string;
}

interface AuthStatus {
  connected: boolean;
  email: string | null;
  name: string | null;
  error: string | null;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [apiKeys, setApiKeys] = useState<MaskedApiKey[]>([]);
  const [newKeyLabel, setNewKeyLabel] = useState("");
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [testCalories, setTestCalories] = useState(250);
  const [testSent, setTestSent] = useState(false);

  const loadSettings = useCallback(async () => {
    const res = await fetch("/api/settings");
    setSettings(await res.json());
  }, []);

  const loadApiKeys = useCallback(async () => {
    const res = await fetch("/api/apikeys");
    setApiKeys(await res.json());
  }, []);

  const loadAuthStatus = useCallback(async () => {
    const res = await fetch("/api/auth/status");
    setAuthStatus(await res.json());
  }, []);

  useEffect(() => {
    loadSettings();
    loadApiKeys();
    loadAuthStatus();
  }, [loadSettings, loadApiKeys, loadAuthStatus]);

  async function saveSettings() {
    if (!settings) return;
    setSaving(true);
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wakeTime: settings.wakeTime,
        sleepTime: settings.sleepTime,
        calorieGoal: settings.calorieGoal,
        calBurnRate: settings.calBurnRate,
      }),
    });
    setSaving(false);
  }

  async function createApiKey() {
    const res = await fetch("/api/apikeys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: newKeyLabel || "Default" }),
    });
    const data = await res.json();
    setNewKeyValue(data.key);
    setNewKeyLabel("");
    loadApiKeys();
  }

  async function deleteApiKey(id: string) {
    await fetch(`/api/apikeys/${id}`, { method: "DELETE" });
    loadApiKeys();
  }

  async function sendTestCalories() {
    await fetch("/api/fitness", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer __test__",
      },
      body: JSON.stringify({ activeCalories: testCalories }),
    });
    setTestSent(true);
    setTimeout(() => setTestSent(false), 3000);
  }

  if (!settings) {
    return (
      <div className="text-center py-12 text-text-muted">Loading...</div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-text">Settings</h1>

      {/* Google Calendar */}
      <section className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-3">
          Google Calendar
        </h2>
        {authStatus?.connected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-success-light border border-success">
              <div className="w-2 h-2 rounded-full bg-success shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text">Connected</p>
                <p className="text-xs text-text-muted truncate">
                  {authStatus.name} ({authStatus.email})
                </p>
              </div>
            </div>
            {authStatus.error === "RefreshTokenError" && (
              <p className="text-sm text-warning">
                Your session expired. Please reconnect below.
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => signIn("google", { callbackUrl: "/settings" })}
                className="px-4 py-2 border border-border rounded-lg hover:bg-border/50 transition-colors text-sm text-text-muted"
              >
                Reconnect
              </button>
              <button
                onClick={() => signOut({ callbackUrl: "/settings" })}
                className="px-4 py-2 border border-danger rounded-lg hover:bg-danger-light transition-colors text-sm text-danger"
              >
                Disconnect
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-text-muted">
              Connect your Google account to import today&apos;s calendar events.
              Read-only access to your primary calendar.
            </p>
            <button
              onClick={() => signIn("google", { callbackUrl: "/settings" })}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors font-medium text-sm"
            >
              Connect Google Account
            </button>
          </div>
        )}
      </section>

      {/* Schedule */}
      <section className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-3">
          Daily Schedule
        </h2>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs text-text-muted mb-1">
              Wake Time
            </label>
            <input
              type="time"
              value={settings.wakeTime}
              onChange={(e) =>
                setSettings({ ...settings, wakeTime: e.target.value })
              }
              className="w-full px-3 py-2 rounded-lg border border-border bg-card text-text"
            />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">
              Sleep Time
            </label>
            <input
              type="time"
              value={settings.sleepTime}
              onChange={(e) =>
                setSettings({ ...settings, sleepTime: e.target.value })
              }
              className="w-full px-3 py-2 rounded-lg border border-border bg-card text-text"
            />
          </div>
        </div>

        <h3 className="text-sm font-medium text-text mb-2 mt-4">
          Fitness Goals
        </h3>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs text-text-muted mb-1">
              Daily Calorie Goal
            </label>
            <input
              type="number"
              value={settings.calorieGoal}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  calorieGoal: Math.max(1, Number(e.target.value)),
                })
              }
              min={1}
              className="w-full px-3 py-2 rounded-lg border border-border bg-card text-text"
            />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">
              Burn Rate (cal/min)
            </label>
            <input
              type="number"
              step="0.5"
              value={settings.calBurnRate}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  calBurnRate: Math.max(0.1, Number(e.target.value)),
                })
              }
              min={0.1}
              className="w-full px-3 py-2 rounded-lg border border-border bg-card text-text"
            />
          </div>
        </div>

        <button
          onClick={saveSettings}
          disabled={saving}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors font-medium text-sm disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </section>

      {/* Quick Fitness Test */}
      <section className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-3">
          Test Fitness Data
        </h2>
        <p className="text-sm text-text-muted mb-3">
          Manually send a calorie value to test the fitness widget on the
          dashboard. This simulates what the Apple Shortcut will do
          automatically.
        </p>
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="block text-xs text-text-muted mb-1">
              Active Calories
            </label>
            <input
              type="number"
              value={testCalories}
              onChange={(e) =>
                setTestCalories(Math.max(0, Number(e.target.value)))
              }
              min={0}
              className="w-full px-3 py-2 rounded-lg border border-border bg-card text-text"
            />
          </div>
          <button
            onClick={sendTestCalories}
            className="px-4 py-2 bg-fitness text-white rounded-lg hover:opacity-90 transition-opacity font-medium text-sm"
          >
            Send
          </button>
        </div>
        {testSent && (
          <p className="text-sm text-success mt-2 font-medium">
            Sent! Check the dashboard to see the fitness widget update.
          </p>
        )}
      </section>

      {/* API Keys for Fitness Shortcut */}
      <section className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-3">
          Fitness API Keys
        </h2>
        <p className="text-sm text-text-muted mb-4">
          Generate an API key for the Apple Shortcut to send your fitness data.
          The shortcut will POST your active calories to{" "}
          <code className="text-xs bg-border px-1.5 py-0.5 rounded">
            POST /api/fitness
          </code>{" "}
          with the key as a Bearer token.
        </p>

        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newKeyLabel}
            onChange={(e) => setNewKeyLabel(e.target.value)}
            placeholder="Key label (e.g. iPhone)"
            className="flex-1 px-3 py-2 rounded-lg border border-border bg-card text-text placeholder:text-text-muted"
          />
          <button
            onClick={createApiKey}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors font-medium text-sm"
          >
            Generate Key
          </button>
        </div>

        {newKeyValue && (
          <div className="p-3 mb-4 bg-success-light border border-success rounded-lg">
            <p className="text-sm font-medium text-text mb-1">
              New API Key (copy now, it won&apos;t be shown again):
            </p>
            <code className="text-xs break-all select-all">{newKeyValue}</code>
          </div>
        )}

        {apiKeys.length > 0 && (
          <div className="space-y-2">
            {apiKeys.map((k) => (
              <div
                key={k.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border"
              >
                <div>
                  <p className="text-sm font-medium text-text">{k.label}</p>
                  <p className="text-xs text-text-muted font-mono">{k.key}</p>
                </div>
                <button
                  onClick={() => deleteApiKey(k.id)}
                  className="text-xs text-danger hover:underline"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Apple Shortcut Instructions */}
      <section className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-3">
          Apple Shortcut Setup
        </h2>
        <div className="prose prose-sm max-w-none text-text-muted space-y-2">
          <p>
            To automatically sync your Apple Fitness calories, create an Apple
            Shortcut on your iPhone:
          </p>
          <ol className="list-decimal pl-5 space-y-1.5 text-sm">
            <li>
              Open the <strong>Shortcuts</strong> app on your iPhone
            </li>
            <li>
              Create a new shortcut with these actions:
              <ul className="list-disc pl-5 mt-1 space-y-1">
                <li>
                  <strong>Find Health Samples</strong> &mdash; Type: Active
                  Energy, Group By: Day, Sort By: Start Date (Latest First),
                  Limit: 1
                </li>
                <li>
                  <strong>Get Contents of URL</strong> &mdash; URL:{" "}
                  <code className="text-xs bg-border px-1 py-0.5 rounded">
                    http://YOUR_LOCAL_IP:3000/api/fitness
                  </code>
                  , Method: POST, Headers: Authorization ={" "}
                  <code className="text-xs bg-border px-1 py-0.5 rounded">
                    Bearer YOUR_API_KEY
                  </code>
                  , Body (JSON):{" "}
                  <code className="text-xs bg-border px-1 py-0.5 rounded">
                    {`{"activeCalories": [Health Value]}`}
                  </code>
                </li>
              </ul>
            </li>
            <li>
              Set up a <strong>Personal Automation</strong> to run this shortcut
              every hour, or when you open a specific app
            </li>
          </ol>
          <p className="mt-3 text-xs">
            Your local network address is{" "}
            <code className="bg-border px-1.5 py-0.5 rounded">
              http://10.50.21.21:3000
            </code>
            . Make sure your iPhone is on the same Wi-Fi network.
          </p>
        </div>
      </section>
    </div>
  );
}
