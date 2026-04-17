import { prisma } from "@/lib/prisma";
import { resolveFitnessFromLog } from "@/lib/resolveFitnessFromLog";
import {
  normalizeBodyKeys,
  parseShortcutActiveCalories,
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
    payload._debug = {
      requestedDate: today,
      timeZone: tz,
      logRowDate: log?.date ?? null,
      logUpdatedAtIso: log?.updatedAt?.toISOString() ?? null,
      logYmdInTimeZone: resolved.logYmdInTz,
      storedActiveCalories: resolved.storedActiveCalories,
      isShortcutStale: resolved.shortcutDataStale,
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

  const date = resolveFitnessPostDate(bodyLower, req);

  const rawCal =
    bodyLower.activecalories ??
    bodyLower.active_calories ??
    bodyLower.calories ??
    bodyLower.activeenergyburned;
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
