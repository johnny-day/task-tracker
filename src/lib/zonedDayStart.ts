/**
 * UTC millis for the first instant of calendar date `ymd` (YYYY-MM-DD) in `timeZone`.
 * Used so server-side "midnight" matches the Shortcut / user calendar day.
 */
export function getZonedDayStartMs(ymd: string, timeZone: string): number | null {
  try {
    const [y, mo, da] = ymd.split("-").map(Number);
    if (!y || !mo || !da) return null;
    let lo = Date.UTC(y, mo - 1, da - 1, 0, 0, 0);
    let hi = Date.UTC(y, mo - 1, da + 2, 0, 0, 0);
    const fmt = (ms: number) =>
      new Intl.DateTimeFormat("sv-SE", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      }).format(new Date(ms));

    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      const label = fmt(mid);
      const [dPart, tPart] = label.split(" ");
      const atOrAfterStart =
        dPart > ymd || (dPart === ymd && tPart >= "00:00:00");
      if (atOrAfterStart) hi = mid;
      else lo = mid + 1;
    }
    return lo;
  } catch {
    return null;
  }
}
