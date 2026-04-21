/** Stored on Task.category; order defines default sort (lower index first). */
export const TASK_CATEGORY_ORDER = [
  "cursor",
  "personal",
  "housework",
  "errands",
  "misc",
  "longterm",
] as const;

export type TaskCategorySlug = (typeof TASK_CATEGORY_ORDER)[number];

export const TASK_CATEGORY_LABELS: Record<TaskCategorySlug, string> = {
  cursor: "Cursor",
  personal: "Personal work",
  housework: "Housework",
  errands: "Errands",
  misc: "Miscellaneous",
  longterm: "Long term",
};

/** Left border accent (Tailwind); longterm uses muted stripe. */
export const TASK_CATEGORY_BORDER: Record<TaskCategorySlug, string> = {
  cursor: "border-l-violet-500",
  personal: "border-l-sky-500",
  housework: "border-l-amber-500",
  errands: "border-l-emerald-500",
  misc: "border-l-border",
  longterm: "border-l-text-muted",
};

const rankBySlug = new Map<string, number>(
  TASK_CATEGORY_ORDER.map((slug, i) => [slug, i])
);

export function categorySortRank(category: string): number {
  return rankBySlug.get(category) ?? rankBySlug.get("misc")!;
}

export function normalizeCategory(raw: unknown): TaskCategorySlug {
  if (typeof raw !== "string" || !raw.trim()) return "misc";
  const s = raw.trim();
  if (s === "general") return "misc";
  if (TASK_CATEGORY_ORDER.includes(s as TaskCategorySlug)) {
    return s as TaskCategorySlug;
  }
  return "misc";
}

export function sortTasksByCategoryThenOrder<
  T extends { category: string; sortOrder: number },
>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) => {
    const ra = categorySortRank(a.category);
    const rb = categorySortRank(b.category);
    if (ra !== rb) return ra - rb;
    return a.sortOrder - b.sortOrder;
  });
}
