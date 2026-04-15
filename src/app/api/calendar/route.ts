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
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
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

    if (!res.ok) {
      return NextResponse.json({ events: [], connected: true, error: "Failed to fetch calendar" });
    }

    const data = await res.json();

    const events: CalendarEvent[] = (data.items || []).map(
      (item: Record<string, unknown>) => {
        const start = item.start as Record<string, string> | undefined;
        const end = item.end as Record<string, string> | undefined;
        const allDay = !!start?.date;

        return {
          id: item.id as string,
          summary: (item.summary as string) || "(No title)",
          start: start?.dateTime || start?.date || "",
          end: end?.dateTime || end?.date || "",
          allDay,
        };
      }
    );

    return NextResponse.json({ events, connected: true });
  } catch {
    return NextResponse.json({
      events: [],
      connected: true,
      error: "Calendar API error",
    });
  }
}
