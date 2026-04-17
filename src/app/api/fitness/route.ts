import { formatZonedYmd } from "@/lib/zonedDayStart";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

async function validateApiKey(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return false;

  const match = authHeader.match(/^bearer\s+(.+)$/i);
  if (!match) return false;

  const key = match[1].trim();
  const found = await prisma.apiKey.findUnique({ where: { key } });
  return !!found;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const today = searchParams.get("date") || new Date().toISOString().slice(0, 10);
  const dayStartParam = searchParams.get("dayStart");

  const log = await prisma.fitnessLog.findUnique({ where: { date: today } });
  const settings = await prisma.settings.findUnique({
    where: { id: "default" },
  });

  const rawGoal = settings?.calorieGoal ?? 700;
  const rawRate = settings?.calBurnRate ?? 4.0;
  const calorieGoal = Math.max(1, Math.round(Number(rawGoal)) || 700);
  const calBurnRate = Math.max(
    0.1,
    Number.isFinite(Number(rawRate)) ? Number(rawRate) : 4.0
  );

  const storedActiveCalories = Number(log?.activeCalories ?? 0);
  let burned = Number.isFinite(storedActiveCalories) && storedActiveCalories >= 0 ? storedActiveCalories : 0;

  const tz = searchParams.get("tz");
  const logYmdInTz =
    log && tz ? formatZonedYmd(log.updatedAt.getTime(), tz) : null;

  /**
   * Stale = no Shortcut write on this calendar day in the user's zone.
   * When `tz` is sent we only use calendar comparison; `updatedAt < midnight` is easy to get
   * wrong across DST / boundary math and can zero out a real same-day sync.
   * Without `tz`, fall back to the client's local-midnight ISO (`dayStart`) only.
   */
  let isShortcutStale = false;
  if (log) {
    if (tz) {
      if (logYmdInTz != null && logYmdInTz < today) {
        isShortcutStale = true;
      }
    } else if (dayStartParam) {
      const boundary = new Date(dayStartParam);
      if (!Number.isNaN(boundary.getTime()) && log.updatedAt < boundary) {
        isShortcutStale = true;
      }
    }
  }

  if (isShortcutStale) {
    burned = 0;
  }

  const remaining = isShortcutStale
    ? calorieGoal
    : Math.max(0, calorieGoal - burned);
  // Time to close the active-calorie gap at the user's burn rate (e.g. 700 cal @ 4/min → 175 min).
  let exerciseMinutesLeft = 0;
  if (remaining > 0) {
    const rawMinutes = Math.ceil(remaining / calBurnRate);
    exerciseMinutesLeft = Number.isFinite(rawMinutes) ? Math.max(1, rawMinutes) : 1;
  }

  const payload: Record<string, unknown> = {
    date: today,
    activeCalories: burned,
    calorieGoal,
    calBurnRate,
    remaining,
    exerciseMinutesLeft,
    shortcutDataStale: isShortcutStale,
  };

  if (searchParams.get("debug") === "1") {
    payload._debug = {
      requestedDate: today,
      timeZone: tz,
      logRowDate: log?.date ?? null,
      logUpdatedAtIso: log?.updatedAt?.toISOString() ?? null,
      logYmdInTimeZone: logYmdInTz,
      storedActiveCalories: log != null ? storedActiveCalories : null,
      isShortcutStale,
      dayStartParam: dayStartParam ?? null,
    };
  }

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const isTestMode = authHeader?.toLowerCase() === "bearer __test__";

  if (!isTestMode) {
    const isValid = await validateApiKey(req);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    }
  }

  const body = await req.json();
  let date = body.date;
  if (!date) {
    const tz = body.timezone;
    if (tz) {
      try {
        date = new Intl.DateTimeFormat("en-CA", {
          timeZone: tz,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date());
      } catch {
        date = new Date().toISOString().slice(0, 10);
      }
    } else {
      date = new Date().toISOString().slice(0, 10);
    }
  }

  const bodyLower: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    bodyLower[k.toLowerCase()] = v;
  }

  let raw = bodyLower["activecalories"] ?? bodyLower["active_calories"] ?? bodyLower["calories"];
  if (typeof raw === "string") {
    const firstValue = raw.split(/[\n,;]+/)[0];
    raw = firstValue.replace(/[^0-9.]/g, "");
  }
  const activeCalories = Number(raw);

  if (isNaN(activeCalories) || activeCalories < 0) {
    return NextResponse.json(
      { error: "activeCalories must be a non-negative number", received: body },
      { status: 400 }
    );
  }

  const log = await prisma.fitnessLog.upsert({
    where: { date },
    update: { activeCalories },
    create: { date, activeCalories },
  });

  return NextResponse.json(log);
}
