import { getServerSession } from "next-auth";
import { authOptions, ExtendedSession } from "@/lib/auth";
import { NextResponse } from "next/server";
import { CalendarEvent } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = (await getServerSession(authOptions)) as ExtendedSession | null;

  if (!session?.accessToken) {
    return NextResponse.json({ events: [], connected: false });
  }

  const accessToken = session.accessToken;

  const now = new Date();
  const startOfDay = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const endOfDay = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

  try {
    const listRes = await fetch(
      "https://www.googleapis.com/calendar/v3/users/me/calendarList",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      }
    );

    let calendarIds = ["primary"];
    if (listRes.ok) {
      const listData = await listRes.json();
      calendarIds = (listData.items || [])
        .filter((c: Record<string, unknown>) => !c.deleted && !c.hidden)
        .map((c: Record<string, unknown>) => c.id as string);
      if (calendarIds.length === 0) calendarIds = ["primary"];
    }

    const allEvents: CalendarEvent[] = [];
    const seenIds = new Set<string>();

    await Promise.all(
      calendarIds.map(async (calId) => {
        const res = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events?` +
            new URLSearchParams({
              timeMin: startOfDay,
              timeMax: endOfDay,
              singleEvents: "true",
              orderBy: "startTime",
            }),
          {
            headers: { Authorization: `Bearer ${accessToken}` },
            cache: "no-store",
          }
        );

        if (!res.ok) return;

        const data = await res.json();
        for (const item of data.items || []) {
          if (seenIds.has(item.id)) continue;
          seenIds.add(item.id);

          const start = item.start as Record<string, string> | undefined;
          const end = item.end as Record<string, string> | undefined;
          const allDay = !!start?.date;

          allEvents.push({
            id: item.id as string,
            summary: (item.summary as string) || "(No title)",
            start: start?.dateTime || start?.date || "",
            end: end?.dateTime || end?.date || "",
            allDay,
          });
        }
      })
    );

    allEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    return NextResponse.json({ events: allEvents, connected: true });
  } catch {
    return NextResponse.json({
      events: [],
      connected: true,
      error: "Calendar API error",
    });
  }
}
