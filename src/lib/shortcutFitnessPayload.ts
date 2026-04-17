import type { NextRequest } from "next/server";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function tryParseJsonString(raw: string): unknown {
  const t = raw.trim();
  if (t.length === 0 || t.length > 50_000) return raw;
  if (!t.startsWith("[") && !t.startsWith("{")) return raw;
  try {
    return JSON.parse(t) as unknown;
  } catch {
    return raw;
  }
}

function quantityFromObject(o: Record<string, unknown>): number | null {
  if (typeof o.doublevalue === "number" && Number.isFinite(o.doublevalue)) {
    return Math.max(0, o.doublevalue);
  }
  if (typeof o.doubleValue === "number" && Number.isFinite(o.doubleValue)) {
    return Math.max(0, o.doubleValue);
  }

  const directKeys = [
    "quantity",
    "value",
    "sumQuantity",
    "sum",
    "activeEnergyBurned",
    "activeEnergyBurnedQuantity",
    "totalEnergyBurned",
  ] as const;
  for (const k of directKeys) {
    const v = o[k];
    if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, v);
    if (typeof v === "string") {
      const n = Number(v.replace(/[^0-9.-]/g, ""));
      if (Number.isFinite(n) && n >= 0) return n;
    }
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const inner = quantityFromObject(v as Record<string, unknown>);
      if (inner != null) return inner;
    }
  }

  const nested = o.quantity;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const q = nested as Record<string, unknown>;
    if (typeof q.doubleValue === "number" && Number.isFinite(q.doubleValue)) {
      return Math.max(0, q.doubleValue);
    }
    if (typeof q.doublevalue === "number" && Number.isFinite(q.doublevalue)) {
      return Math.max(0, q.doublevalue);
    }
    if (typeof q.value === "number" && Number.isFinite(q.value)) {
      return Math.max(0, q.value);
    }
  }
  return null;
}

/**
 * Shortcuts “Active Calories” with unit **cal** (small calories) can send totals
 * ~1000× dietary kcal. Collapse only obviously huge values.
 */
function normalizeLikelyDietaryKcal(n: number): number {
  if (!Number.isFinite(n) || n < 0) return n;
  if (n >= 50_000 && n <= 12_000_000) {
    const scaled = n / 1000;
    if (scaled >= 0 && scaled <= 30_000) return scaled;
  }
  return n;
}

/**
 * Turn Shortcut / HealthKit–shaped values into a single non‑negative calorie number.
 * Shortcuts often send a dictionary or array instead of a bare number.
 */
export function parseShortcutActiveCalories(raw: unknown): number | null {
  if (raw == null) return null;

  if (typeof raw === "string") {
    const parsed = tryParseJsonString(raw);
    if (parsed !== raw) return parseShortcutActiveCalories(parsed);
    const first = raw.split(/[\n,;]+/)[0]?.replace(/[^0-9.]/g, "") ?? "";
    const n = Number(first);
    if (!Number.isFinite(n) || n < 0) return null;
    return normalizeLikelyDietaryKcal(n);
  }

  if (typeof raw === "number" && Number.isFinite(raw)) {
    if (raw < 0) return null;
    return normalizeLikelyDietaryKcal(raw);
  }

  if (Array.isArray(raw)) {
    let sum = 0;
    let any = false;
    for (const item of raw) {
      const v = parseShortcutActiveCalories(item);
      if (v != null) {
        sum += v;
        any = true;
      }
    }
    return any ? normalizeLikelyDietaryKcal(sum) : null;
  }

  if (typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    const q = quantityFromObject(o);
    if (q != null) return normalizeLikelyDietaryKcal(q);
  }

  return null;
}

/**
 * Keys from Shortcuts JSON often include spaces (“Active Calories”) or mixed case.
 * Canonical form: lowercased with spaces / underscores / hyphens removed.
 */
export function normalizeBodyKeys(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    const c = k.toLowerCase().replace(/[\s_-]+/g, "");
    out[c] = v;
  }
  return out;
}

export type ResolveFitnessPostDateOptions = {
  /** When the Shortcut omits `timezone`, use this IANA zone before IP / UTC (Settings). */
  settingsFallbackTz?: string | null;
};

function ymdInTimeZone(timeZone: string, instant: Date = new Date()): string | null {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(instant);
  } catch {
    return null;
  }
}

/**
 * Calendar YYYY‑MM‑DD for the fitness row: explicit ISO date, else IANA zone from
 * body, then Settings fallback, then Vercel edge, then UTC calendar day.
 */
export function resolveFitnessPostDate(
  bodyLower: Record<string, unknown>,
  req: NextRequest,
  options?: ResolveFitnessPostDateOptions
): string {
  const explicit = bodyLower.date;
  if (typeof explicit === "string" && ISO_DATE.test(explicit.trim())) {
    return explicit.trim();
  }

  const tzRaw =
    bodyLower.timezone ?? bodyLower.time_zone ?? bodyLower.tz;
  const fromBody = typeof tzRaw === "string" ? tzRaw.trim() : "";

  const settingsRaw = options?.settingsFallbackTz;
  const fromSettings =
    typeof settingsRaw === "string" ? settingsRaw.trim() : "";

  const edgeTz = req.headers.get("x-vercel-ip-timezone")?.trim() ?? "";

  const now = new Date();
  for (const tz of [fromBody, fromSettings, edgeTz]) {
    if (!tz) continue;
    const ymd = ymdInTimeZone(tz, now);
    if (ymd) return ymd;
  }

  return now.toISOString().slice(0, 10);
}

/**
 * First non‑empty payload field Shortcuts might bind (sum, raw Health Samples, etc.).
 */
export function pickRawCaloriesFromBody(bodyLower: Record<string, unknown>): unknown {
  const keys = [
    "activecalories",
    "activeenergyburned",
    "healthsamples",
    "healthsample",
    "samples",
    "sumofhealthsamples",
    "calculationresult",
  ] as const;
  for (const k of keys) {
    const v = bodyLower[k];
    if (v !== undefined && v !== null) return v;
  }
  return undefined;
}
