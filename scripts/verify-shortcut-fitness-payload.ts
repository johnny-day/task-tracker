/**
 * Run: npx tsx scripts/verify-shortcut-fitness-payload.ts
 */
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import {
  parseShortcutActiveCalories,
  resolveFitnessPostDate,
} from "../src/lib/shortcutFitnessPayload";

assert.equal(parseShortcutActiveCalories(266), 266);
assert.equal(parseShortcutActiveCalories("266 kcal"), 266);
assert.equal(parseShortcutActiveCalories('[{"quantity":100}]'), 100);
assert.equal(
  parseShortcutActiveCalories([{ quantity: 50 }, { value: 25.5 }]),
  75.5
);
assert.equal(
  parseShortcutActiveCalories({ quantity: 12, unit: "kcal" as unknown as string }),
  12
);

const req = new NextRequest("https://example.com/api/fitness");
assert.equal(
  resolveFitnessPostDate(
    { timezone: "America/Chicago" },
    req
  ).length,
  10
);

const reqTz = new NextRequest("https://example.com/api/fitness", {
  headers: { "x-vercel-ip-timezone": "America/Los_Angeles" },
});
assert.match(resolveFitnessPostDate({}, reqTz), /^\d{4}-\d{2}-\d{2}$/);

console.log("verify-shortcut-fitness-payload: ok");
