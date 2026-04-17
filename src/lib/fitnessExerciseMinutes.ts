/** Minutes of exercise to close the active-calorie gap at `calBurnRate` (cal/min). */
export function exerciseMinutesFromBurnProgress(
  calorieGoal: number,
  activeCalories: number,
  calBurnRate: number
): number {
  const goal = Math.max(1, Math.round(calorieGoal) || 1);
  const active = Number.isFinite(activeCalories) && activeCalories >= 0 ? activeCalories : 0;
  const rate = Number.isFinite(calBurnRate) && calBurnRate > 0 ? calBurnRate : 4;
  const remaining = Math.max(0, goal - active);
  return remaining <= 0 ? 0 : Math.max(1, Math.ceil(remaining / rate));
}
