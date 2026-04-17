/**
 * Calendar YYYY-MM-DD and IANA zone the browser uses for GET /api/fitness.
 * POST /api/fitness should send the same `date` (and ideally `timezone`) so
 * Prisma upserts the row the dashboard reads.
 */
export function getBrowserFitnessDayContext(): { date: string; timeZone: string } {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return { date, timeZone };
}
