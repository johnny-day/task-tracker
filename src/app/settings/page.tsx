"use client";

import { useCallback, useEffect, useState } from "react";
import { signIn, signOut } from "next-auth/react";
import { getFitnessDayContextForDisplay } from "@/lib/fitnessBrowserDay";
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState<MaskedApiKey[]>([]);
  const [newKeyLabel, setNewKeyLabel] = useState("");
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [testCalories, setTestCalories] = useState(250);
  const [testSent, setTestSent] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    setLoadError(null);
    const res = await fetch("/api/settings");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setLoadError(
        typeof data?.error === "string"
          ? data.error
          : `Could not load settings (HTTP ${res.status}).`
      );
      setSettings(null);
      return;
    }
    if (data?.error) {
      setLoadError(String(data.error));
      setSettings(null);
      return;
    }
    const ftz = data.fitnessTimeZone;
    setSettings({
      ...data,
      burnRateOnboardingDone: Boolean(data.burnRateOnboardingDone),
      fitnessTimeZone:
        typeof ftz === "string" && ftz.trim() !== "" ? ftz.trim() : null,
    });
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
        burnRateOnboardingDone: true,
        fitnessTimeZone: settings.fitnessTimeZone,
      }),
    });
    await loadSettings();
    setSaving(false);
  }

  async function useDefaultBurnRateAndDismiss() {
    if (!settings) return;
    setSaving(true);
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        calBurnRate: 4.0,
        burnRateOnboardingDone: true,
      }),
    });
    await loadSettings();
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
    setTestError(null);
    if (!settings) return;
    const { date, timeZone } = getFitnessDayContextForDisplay(
      settings.fitnessTimeZone ?? null
    );
    const res = await fetch("/api/fitness", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer __test__",
      },
      body: JSON.stringify({
        activeCalories: testCalories,
        date,
        timezone: timeZone,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setTestError(
        typeof data?.error === "string"
          ? data.error
          : `Request failed (HTTP ${res.status}).`
      );
      return;
    }
    setTestSent(true);
    setTimeout(() => setTestSent(false), 3000);
  }

  if (!settings) {
    return (
      <div className="max-w-lg mx-auto text-center py-12 space-y-3">
        <p className="text-text-muted">
          {loadError ? loadError : "Loading…"}
        </p>
        {loadError && (
          <button
            type="button"
            onClick={() => loadSettings()}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover"
          >
            Try again
          </button>
        )}
      </div>
    );
  }

  const showBurnRateOnboarding = settings.burnRateOnboardingDone === false;

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-text">Settings</h1>

      {showBurnRateOnboarding && (
        <section
          className="bg-primary-light border border-primary/40 rounded-lg p-5"
          aria-labelledby="burn-rate-onboarding-heading"
        >
          <h2
            id="burn-rate-onboarding-heading"
            className="text-base font-semibold text-text mb-2"
          >
            Set your exercise burn rate
          </h2>
          <p className="text-sm text-text-muted mb-3">
            The dashboard uses <strong className="text-text">calories per minute</strong>{" "}
            to turn your remaining calorie budget into &quot;minutes of exercise
            left.&quot; Typical values are roughly <strong className="text-text">3–8</strong>{" "}
            depending on how hard you usually work out (walking vs. vigorous
            cardio).
          </p>
          <div className="mb-4 max-w-xs">
            <label className="block text-xs text-text-muted mb-1">
              Burn rate (cal/min)
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
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={saveSettings}
              disabled={saving}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors font-medium text-sm disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save and continue"}
            </button>
            <button
              type="button"
              onClick={useDefaultBurnRateAndDismiss}
              disabled={saving}
              className="px-4 py-2 border border-border rounded-lg hover:bg-border/50 transition-colors font-medium text-sm text-text disabled:opacity-50"
            >
              Use default (4 cal/min)
            </button>
          </div>
        </section>
      )}

      {/* Google Calendar */}
      <section className="bg-card border border-border rounded-lg p-5">
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
      <section className="bg-card border border-border rounded-lg p-5">
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

        <div className="mb-4">
          <label className="block text-xs text-text-muted mb-1">
            Fitness calendar time zone (IANA)
          </label>
          <input
            type="text"
            value={settings.fitnessTimeZone ?? ""}
            onChange={(e) =>
              setSettings({
                ...settings,
                fitnessTimeZone:
                  e.target.value.trim() === "" ? null : e.target.value,
              })
            }
            placeholder="e.g. America/Chicago"
            className="w-full px-3 py-2 rounded-lg border border-border bg-card text-text font-mono text-sm"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
          />
          <p className="text-xs text-text-muted mt-1.5 leading-relaxed">
            Use this if your Apple Shortcut only sends{" "}
            <code className="bg-border/60 px-1 rounded">activeCalories</code>{" "}
            (no <code className="bg-border/60 px-1 rounded">timezone</code> in
            the JSON). Set it to the same IANA zone as your iPhone&apos;s day for
            Health (for example where you live). Leave empty to use this
            browser&apos;s time zone for the dashboard and test POST.
          </p>
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
      <section className="bg-card border border-border rounded-lg p-5">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-3">
          Test Fitness Data
        </h2>
        <p className="text-sm text-text-muted mb-3">
          Manually send a calorie value to test the fitness widget on the
          dashboard. The request uses the same calendar day as the home page
          (saved fitness time zone if set, otherwise this browser&apos;s zone).
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
        {testError && (
          <p className="text-sm text-danger mt-2 font-medium" role="alert">
            {testError}
          </p>
        )}
      </section>

      {/* API Keys for Fitness Shortcut */}
      <section className="bg-card border border-border rounded-lg p-5">
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
        <p className="text-sm text-text-muted mb-4 p-3 rounded-lg border border-border bg-card">
          <strong className="text-text">Why doesn&apos;t this site pull my
          Apple calories automatically?</strong> Only Apple-approved apps (like
          Shortcuts or a native iOS app) can read HealthKit. This website
          receives calories when your Shortcut <em>sends</em> them—set up a{" "}
          <strong className="text-text">Personal Automation</strong> in the
          Shortcuts app (see Step 6 below) so that happens on a schedule without
          tapping Run each time.
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
      <section className="bg-card border border-border rounded-lg p-5">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-3">
          Apple Shortcut Setup
        </h2>
        <div className="text-sm text-text-muted space-y-4">
          <p>
            Follow these steps to automatically sync your Apple Fitness
            calories from your iPhone. Read each step carefully.
          </p>

          {/* Step 1 */}
          <div className="p-3 rounded-lg border border-border bg-card">
            <p className="font-semibold text-text mb-1">
              Step 1: Generate your API key
            </p>
            <p>
              Scroll up to <strong>Fitness API Keys</strong> on this page and
              click <strong>Generate Key</strong>. Copy the full key (it starts
              with{" "}
              <code className="text-xs bg-border px-1 py-0.5 rounded">
                ttk_
              </code>
              ). You will need this in Step 4.
            </p>
            <div className="mt-2 p-2 rounded bg-warning-light border border-warning text-xs text-warning">
              <strong>Important:</strong> Generate the key on THIS website
              (the live app), not on localhost. Keys are tied to the database
              they were created on.
            </div>
          </div>

          {/* Step 2 */}
          <div className="p-3 rounded-lg border border-border bg-card">
            <p className="font-semibold text-text mb-1">
              Step 2: Open the Shortcuts app
            </p>
            <p>
              On your iPhone, open the <strong>Shortcuts</strong> app and tap
              the <strong>+</strong> button to create a new shortcut.
            </p>
          </div>

          {/* Step 3 */}
          <div className="p-3 rounded-lg border border-border bg-card">
            <p className="font-semibold text-text mb-1">
              Step 3: Add &quot;Find Health Samples&quot;
            </p>
            <p className="mb-2">
              Search for and add the{" "}
              <strong>Find Health Samples</strong> action. Configure it
              exactly as follows:
            </p>
            <div className="grid grid-cols-2 gap-1 text-xs">
              <div className="p-1.5 bg-border/30 rounded">
                <span className="text-text-muted">Type</span>
              </div>
              <div className="p-1.5 bg-border/30 rounded font-medium text-text">
                Active Energy
              </div>
              <div className="p-1.5 bg-border/30 rounded">
                <span className="text-text-muted">Group By</span>
              </div>
              <div className="p-1.5 bg-border/30 rounded font-medium text-text">
                Day
              </div>
              <div className="p-1.5 bg-border/30 rounded">
                <span className="text-text-muted">Sort By</span>
              </div>
              <div className="p-1.5 bg-border/30 rounded font-medium text-text">
                Start Date (Latest First)
              </div>
              <div className="p-1.5 bg-border/30 rounded">
                <span className="text-text-muted">Limit</span>
              </div>
              <div className="p-1.5 bg-border/30 rounded font-medium text-text">
                1
              </div>
            </div>
            <div className="mt-2 p-2 rounded bg-warning-light border border-warning text-xs text-warning">
              <strong>Important:</strong> Setting Limit to{" "}
              <strong>1</strong> is critical. Without it, the shortcut may
              send multiple values and the calorie count will be wrong.
            </div>
          </div>

          {/* Step 4 */}
          <div className="p-3 rounded-lg border border-border bg-card">
            <p className="font-semibold text-text mb-1">
              Step 4: Add &quot;Get Contents of URL&quot;
            </p>
            <p className="mb-2">
              Search for and add the{" "}
              <strong>Get Contents of URL</strong> action. Configure each
              field:
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <p className="font-medium text-text mb-1">URL:</p>
                <code className="block bg-border px-2 py-1.5 rounded select-all break-all">
                  https://task-tracker-roan-one.vercel.app/api/fitness
                </code>
              </div>

              <div>
                <p className="font-medium text-text mb-1">Method:</p>
                <p>
                  Tap <strong>Show More</strong>, then set Method to{" "}
                  <strong>POST</strong>
                </p>
              </div>

              <div>
                <p className="font-medium text-text mb-1">Headers:</p>
                <p className="mb-1">
                  Tap <strong>Add New Header</strong>. The Shortcuts app
                  gives you two fields, Key and Value:
                </p>
                <div className="grid grid-cols-[80px_1fr] gap-1">
                  <div className="p-1.5 bg-border/30 rounded font-medium text-text">
                    Key
                  </div>
                  <div className="p-1.5 bg-border/30 rounded font-mono">
                    Authorization
                  </div>
                  <div className="p-1.5 bg-border/30 rounded font-medium text-text">
                    Value
                  </div>
                  <div className="p-1.5 bg-border/30 rounded font-mono break-all">
                    Bearer ttk_your_key_here
                  </div>
                </div>
                <div className="mt-2 p-2 rounded bg-warning-light border border-warning text-warning">
                  <strong>Common mistakes:</strong>
                  <ul className="list-disc pl-4 mt-1 space-y-0.5">
                    <li>
                      The Value must start with the word{" "}
                      <strong>Bearer</strong> (capital B), then a space,
                      then your{" "}
                      <code className="bg-border px-1 rounded">ttk_</code>{" "}
                      key
                    </li>
                    <li>
                      Do NOT type{" "}
                      <code className="bg-border px-1 rounded">
                        Authorization =
                      </code>{" "}
                      in the Value field &mdash; just the Bearer token
                    </li>
                    <li>
                      Do NOT paste the key without{" "}
                      <code className="bg-border px-1 rounded">
                        Bearer{" "}
                      </code>{" "}
                      in front of it
                    </li>
                  </ul>
                </div>
              </div>

              <div>
                <p className="font-medium text-text mb-1">Request Body:</p>
                <p className="mb-1">
                  Set body type to <strong>JSON</strong>, then tap{" "}
                  <strong>Add New Field</strong> and choose{" "}
                  <strong>Text</strong>:
                </p>
                <div className="grid grid-cols-[80px_1fr] gap-1">
                  <div className="p-1.5 bg-border/30 rounded font-medium text-text">
                    Key
                  </div>
                  <div className="p-1.5 bg-border/30 rounded font-mono">
                    activeCalories
                  </div>
                  <div className="p-1.5 bg-border/30 rounded font-medium text-text">
                    Value
                  </div>
                  <div className="p-1.5 bg-border/30 rounded">
                    Tap and select the{" "}
                    <strong>Health Samples</strong> variable from Step 3
                  </div>
                </div>
                <p className="mt-2 mb-1">
                  Then tap <strong>Add New Field</strong> &rarr;{" "}
                  <strong>Text</strong> again to add a second field:
                </p>
                <div className="grid grid-cols-[80px_1fr] gap-1">
                  <div className="p-1.5 bg-border/30 rounded font-medium text-text">
                    Key
                  </div>
                  <div className="p-1.5 bg-border/30 rounded font-mono">
                    timezone
                  </div>
                  <div className="p-1.5 bg-border/30 rounded font-medium text-text">
                    Value
                  </div>
                  <div className="p-1.5 bg-border/30 rounded font-mono">
                    America/Los_Angeles
                  </div>
                </div>
                <div className="mt-2 p-2 rounded bg-primary-light border border-primary/30 text-xs text-primary">
                  <strong>Why timezone?</strong> The server runs in UTC.
                  Without this field, calories posted after 5 PM Pacific
                  would be stored under the next day and carry over into
                  tomorrow.
                </div>
                <div className="mt-2 p-2 rounded bg-warning-light border border-warning text-warning">
                  <strong>Do NOT</strong> paste raw JSON like{" "}
                  <code className="bg-border px-1 rounded">
                    {`{"activeCalories": ...}`}
                  </code>{" "}
                  as one field. Use the key/value fields the Shortcuts
                  app provides.
                </div>
              </div>
            </div>
          </div>

          {/* Step 5 */}
          <div className="p-3 rounded-lg border border-border bg-card">
            <p className="font-semibold text-text mb-1">Step 5: Test it</p>
            <p>
              Tap the <strong>play button</strong> in the Shortcuts app to
              run it once. Then check the dashboard &mdash; the fitness
              widget should update within a few seconds.
            </p>
          </div>

          {/* Step 6 */}
          <div className="p-3 rounded-lg border border-border bg-card">
            <p className="font-semibold text-text mb-1">
              Step 6: Set up automation
            </p>
            <p className="mb-2">
              Go to the <strong>Automation</strong> tab in Shortcuts. Tap{" "}
              <strong>+</strong> and choose <strong>Create Personal
              Automation</strong>. Pick a trigger that fits your day—examples:
            </p>
            <ul className="list-disc pl-5 space-y-1 mb-2">
              <li>
                <strong className="text-text">Time of Day</strong> — e.g. every
                1–2 hours while you are awake, or a few fixed times (morning,
                lunch, evening).
              </li>
              <li>
                <strong className="text-text">Alarm</strong> /{" "}
                <strong className="text-text">Sleep</strong> — run once when
                you wake up so the dashboard starts with today&apos;s calories.
              </li>
              <li>
                <strong className="text-text">App</strong> — when you open{" "}
                <strong>Fitness</strong>, <strong>Health</strong>, or another app
                you use after workouts.
              </li>
            </ul>
            <p className="mb-2">
              Add the action <strong>Run Shortcut</strong> and select the
              shortcut you built above. Turn off{" "}
              <strong>Ask Before Running</strong> if you want it to fire without
              a confirmation tap (iOS may still show a notification or banner for
              some triggers—Apple controls that).
            </p>
            <p className="mb-2 p-2 rounded bg-border/30 text-xs">
              For best reliability, leave <strong>Background App
              Refresh</strong> on for Shortcuts (Settings → Shortcuts) and allow
              any automation or notification prompts Shortcuts requests the first
              time a trigger runs.
            </p>
          </div>

          {/* Troubleshooting */}
          <div className="p-3 rounded-lg border border-danger/30 bg-danger-light/30">
            <p className="font-semibold text-text mb-2">Troubleshooting</p>
            <div className="space-y-2 text-xs">
              <div>
                <p className="font-medium text-text">
                  &quot;Invalid API key&quot;
                </p>
                <ul className="list-disc pl-4 mt-0.5 space-y-0.5">
                  <li>
                    Did you generate the key on the{" "}
                    <strong>live website</strong> (not localhost)?
                  </li>
                  <li>
                    Does the header Value start with{" "}
                    <code className="bg-border px-1 rounded">Bearer </code>
                    followed by the key?
                  </li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-text">
                  &quot;activeCalories must be a number&quot;
                </p>
                <ul className="list-disc pl-4 mt-0.5 space-y-0.5">
                  <li>
                    Make sure <strong>Limit</strong> is set to{" "}
                    <strong>1</strong> in the Find Health Samples action
                  </li>
                  <li>
                    Make sure the body key is exactly{" "}
                    <code className="bg-border px-1 rounded">
                      activeCalories
                    </code>
                  </li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-text">
                  Still not working?
                </p>
                <p>
                  Use the <strong>Test Fitness Data</strong> section above
                  to verify the API is responding. If the test works but
                  the Shortcut doesn&apos;t, the issue is in the Shortcut
                  configuration.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
