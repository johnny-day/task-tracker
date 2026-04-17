/**
 * Automated checks for fitness day math (no DB, no server).
 * Run: npm run verify:fitness
 */
import assert from "node:assert/strict";
import { resolveFitnessFromLog } from "../src/lib/resolveFitnessFromLog";

// Previous calendar day in Chicago → stale; stored calories ignored for gap math
const stale = resolveFitnessFromLog({
  today: "2026-04-17",
  tz: "America/Chicago",
  dayStartParam: null,
  log: {
    date: "2026-04-17",
    activeCalories: 620,
    updatedAt: new Date("2026-04-16T23:00:00-05:00"),
  },
  calorieGoal: 700,
  calBurnRate: 4,
});
assert.equal(stale.shortcutDataStale, true);
assert.equal(stale.activeCalories, 0);
assert.equal(stale.remaining, 700);
assert.equal(stale.exerciseMinutesLeft, 175);

// Same calendar day in Chicago → not stale; use stored burn
const fresh = resolveFitnessFromLog({
  today: "2026-04-17",
  tz: "America/Chicago",
  dayStartParam: null,
  log: {
    date: "2026-04-17",
    activeCalories: 120,
    updatedAt: new Date("2026-04-17T10:00:00-05:00"),
  },
  calorieGoal: 700,
  calBurnRate: 4,
});
assert.equal(fresh.shortcutDataStale, false);
assert.equal(fresh.activeCalories, 120);
assert.equal(fresh.remaining, 580);
assert.equal(fresh.exerciseMinutesLeft, 145);

// After local midnight for `today`, even if the row was written at a UTC instant
// that still maps to the *previous* calendar label in that zone, we trust it
// once `updatedAt` is past `today` 00:00 in that zone (avoids false "stale").
const afterMidnightChicago = resolveFitnessFromLog({
  today: "2026-04-17",
  tz: "America/Chicago",
  dayStartParam: null,
  log: {
    date: "2026-04-17",
    activeCalories: 266,
    updatedAt: new Date("2026-04-17T06:00:00.000Z"),
  },
  calorieGoal: 700,
  calBurnRate: 4,
});
assert.equal(afterMidnightChicago.shortcutDataStale, false);
assert.equal(afterMidnightChicago.activeCalories, 266);
assert.equal(afterMidnightChicago.exerciseMinutesLeft, 109);

// No row yet
const empty = resolveFitnessFromLog({
  today: "2026-04-17",
  tz: "America/Chicago",
  dayStartParam: null,
  log: null,
  calorieGoal: 700,
  calBurnRate: 4,
});
assert.equal(empty.shortcutDataStale, false);
assert.equal(empty.remaining, 700);
assert.equal(empty.exerciseMinutesLeft, 175);

// Legacy: no tz, dayStart before last write → not stale
const noTz = resolveFitnessFromLog({
  today: "2026-04-17",
  tz: null,
  dayStartParam: "2026-04-17T05:00:00.000Z",
  log: {
    date: "2026-04-17",
    activeCalories: 100,
    updatedAt: new Date("2026-04-17T12:00:00.000Z"),
  },
  calorieGoal: 700,
  calBurnRate: 4,
});
assert.equal(noTz.shortcutDataStale, false);
assert.equal(noTz.remaining, 600);

console.log("verify-fitness: all checks passed.");
