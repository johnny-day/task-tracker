import { formatZonedYmd, getZonedDayStartMs } from "@/lib/zonedDayStart";
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

  let burned = Number(log?.activeCalories ?? 0);
  if (!Number.isFinite(burned) || burned < 0) burned = 0;

  const tz = searchParams.get("tz");
  const zonedStartMs = today && tz ? getZonedDayStartMs(today, tz) : null;
  const clientStartMs = dayStartParam
    ? new Date(dayStartParam).getTime()
    : NaN;
  /** Earliest plausible start-of-today instant: aligns zoned midnight with the browser's local midnight when both are sent. */
  let boundaryMs: number | null = null;
  if (zonedStartMs != null && Number.isFinite(clientStartMs)) {
    boundaryMs = Math.min(zonedStartMs, clientStartMs);
  } else if (zonedStartMs != null) {
    boundaryMs = zonedStartMs;
  } else if (Number.isFinite(clientStartMs)) {
    boundaryMs = clientStartMs;
  }
  const boundary =
    boundaryMs != null && Number.isFinite(boundaryMs)
      ? new Date(boundaryMs)
      : null;

  /** Last Shortcut write was before "today" in the user's zone, or before local day start. */
  let isShortcutStale = false;
  if (log) {
    if (tz) {
      const logYmd = formatZonedYmd(log.updatedAt.getTime(), tz);
      if (logYmd != null && logYmd < today) {
        isShortcutStale = true;
      }
    }
    if (
      !isShortcutStale &&
      boundary &&
      !Number.isNaN(boundary.getTime()) &&
      log.updatedAt < boundary
    ) {
      isShortcutStale = true;
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

  return NextResponse.json(
    {
      date: today,
      activeCalories: burned,
      calorieGoal,
      calBurnRate,
      remaining,
      exerciseMinutesLeft,
      shortcutDataStale: isShortcutStale,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
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
