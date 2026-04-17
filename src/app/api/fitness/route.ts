import { prisma } from "@/lib/prisma";
import { loadSettings } from "@/lib/loadSettings";
import { resolveFitnessFromLog } from "@/lib/resolveFitnessFromLog";
import {
  normalizeBodyKeys,
  parseShortcutActiveCalories,
  pickRawCaloriesFromBody,
  resolveFitnessPostDate,
} from "@/lib/shortcutFitnessPayload";
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
  const settings = await loadSettings();

  const rawGoal = settings.calorieGoal;
  const rawRate = settings.calBurnRate;
  const calorieGoal = Math.max(1, Math.round(Number(rawGoal)) || 700);
  const calBurnRate = Math.max(
    0.1,
    Number.isFinite(Number(rawRate)) ? Number(rawRate) : 4.0
  );

  const tz = searchParams.get("tz");

  const resolved = resolveFitnessFromLog({
    today,
    tz,
    dayStartParam,
    log,
    calorieGoal,
    calBurnRate,
  });

  const payload: Record<string, unknown> = {
    date: today,
    activeCalories: resolved.activeCalories,
    calorieGoal,
    calBurnRate,
    remaining: resolved.remaining,
    exerciseMinutesLeft: resolved.exerciseMinutesLeft,
    shortcutDataStale: resolved.shortcutDataStale,
  };

  if (searchParams.get("debug") === "1") {
    const rowFound = log != null;
    const debug: Record<string, unknown> = {
      requestedDate: today,
      timeZone: tz,
      logRowDate: log?.date ?? null,
      logUpdatedAtIso: log?.updatedAt?.toISOString() ?? null,
      logYmdInTimeZone: resolved.logYmdInTz,
      storedActiveCalories: resolved.storedActiveCalories,
      isShortcutStale: resolved.shortcutDataStale,
      dayStartParam: dayStartParam ?? null,
      rowFound,
      settingsFitnessTimeZone: settings.fitnessTimeZone,
    };
    if (!rowFound) {
      const tzUnset =
        settings.fitnessTimeZone == null ||
        settings.fitnessTimeZone.trim() === "";
      debug.hint = tzUnset
        ? "No FitnessLog for this date. If the Shortcut only sends activeCalories, set Fitness calendar time zone in Settings so POST and GET share the same calendar day."
        : "No FitnessLog for this date. Confirm Settings fitness time zone matches your location, then run the Shortcut again.";
    }
    payload._debug = debug;
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

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      {
        error:
          "Invalid JSON body. Use Content-Type: application/json and key/value fields (or raw JSON) for activeCalories.",
      },
      { status: 400 }
    );
  }

  const bodyLower = normalizeBodyKeys(
    body && typeof body === "object" && !Array.isArray(body) ? body : {}
  );

  const settings = await loadSettings();

  const date = resolveFitnessPostDate(bodyLower, req, {
    settingsFallbackTz: settings.fitnessTimeZone,
  });

  const rawCal = pickRawCaloriesFromBody(bodyLower);
  const activeCalories = parseShortcutActiveCalories(rawCal);

  if (activeCalories == null) {
    return NextResponse.json(
      {
        error:
          "Could not read activeCalories. Send a number, or a Health sample object/array (quantity/value).",
        received: body,
      },
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
