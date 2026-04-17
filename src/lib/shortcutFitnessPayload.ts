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
  const directKeys = [
    "quantity",
    "value",
    "sumQuantity",
    "activeEnergyBurned",
    "activeEnergyBurnedQuantity",
  ] as const;
  for (const k of directKeys) {
    const v = o[k];
    if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, v);
    if (typeof v === "string") {
      const n = Number(v.replace(/[^0-9.-]/g, ""));
      if (Number.isFinite(n) && n >= 0) return n;
    }
  }
  const nested = o.quantity;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const q = nested as Record<string, unknown>;
    if (typeof q.value === "number" && Number.isFinite(q.value)) {
      return Math.max(0, q.value);
    }
  }
  return null;
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
    return Number.isFinite(n) && n >= 0 ? n : null;
  }

  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw >= 0 ? raw : null;
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
    return any ? sum : null;
  }

  if (typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    const q = quantityFromObject(o);
    if (q != null) return q;
  }

  return null;
}

/** Lowercase keys for case‑insensitive JSON from Shortcuts. */
export function normalizeBodyKeys(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    out[k.toLowerCase()] = v;
  }
  return out;
}

/**
 * Calendar YYYY‑MM‑DD for the fitness row: explicit ISO date, else IANA zone from
 * body or edge (Vercel), else UTC calendar day (legacy).
 */
export function resolveFitnessPostDate(
  bodyLower: Record<string, unknown>,
  req: NextRequest
): string {
  const explicit = bodyLower.date;
  if (typeof explicit === "string" && ISO_DATE.test(explicit.trim())) {
    return explicit.trim();
  }

  const tzRaw =
    bodyLower.timezone ?? bodyLower.time_zone ?? bodyLower.tz;
  const fromBody = typeof tzRaw === "string" ? tzRaw.trim() : "";

  const edgeTz = req.headers.get("x-vercel-ip-timezone")?.trim() ?? "";

  for (const tz of [fromBody, edgeTz]) {
    if (!tz) continue;
    try {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
    } catch {
      /* try next */
    }
  }

  return new Date().toISOString().slice(0, 10);
}
