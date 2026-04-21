/** YYYY-MM-DD for "today" in the given IANA zone (falls back to UTC calendar date). */
export function todayInTimeZone(tz: string | null | undefined): string {
  if (tz) {
    try {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
    } catch {
      /* fall through */
    }
  }
  return new Date().toISOString().slice(0, 10);
}
