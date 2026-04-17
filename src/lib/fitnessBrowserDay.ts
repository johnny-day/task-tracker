import { getZonedDayStartMs } from "@/lib/zonedDayStart";

/**
 * True if `tz` is a usable IANA time zone ID for Intl.
 */
export function isValidIanaTimeZone(tz: string): boolean {
  const t = tz.trim();
  if (!t) return false;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: t }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export type FitnessDayContext = {
  date: string;
  timeZone: string;
  /** UTC ISO instant for start of `date` in `timeZone` (for GET `dayStart` when tz is set). */
  dayStartUtcIso: string;
};

/**
 * Calendar day + zone for GET /api/fitness. Uses `settingsTimeZone` when valid
 * (must match Settings / Shortcut “home” zone); otherwise the browser zone.
 */
export function getFitnessDayContextForDisplay(
  settingsTimeZone?: string | null
): FitnessDayContext {
  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const timeZone =
    settingsTimeZone && isValidIanaTimeZone(settingsTimeZone)
      ? settingsTimeZone.trim()
      : browserTz;
  const now = new Date();
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const startMs = getZonedDayStartMs(date, timeZone);
  let dayStartUtcIso: string;
  if (startMs != null) {
    dayStartUtcIso = new Date(startMs).toISOString();
  } else {
    const d = new Date();
    dayStartUtcIso = new Date(
      d.getFullYear(),
      d.getMonth(),
      d.getDate(),
      0,
      0,
      0,
      0
    ).toISOString();
  }
  return { date, timeZone, dayStartUtcIso };
}

/**
 * Browser-only calendar day (e.g. settings “Send test” POST should match laptop local day).
 */
export function getBrowserFitnessDayContext(): Pick<FitnessDayContext, "date" | "timeZone"> {
  const { date, timeZone } = getFitnessDayContextForDisplay(null);
  return { date, timeZone };
}
