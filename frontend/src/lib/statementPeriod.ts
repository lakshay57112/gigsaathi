// Period choices for the income statement and the date maths behind them.

export const PERIODS = [
  { id: "p30", days: 30 },
  { id: "p90", days: 90 },
  { id: "p180", days: 180 },
  { id: "p365", days: 365 },
] as const;

export type PeriodId = (typeof PERIODS)[number]["id"];

/** "2026-10-17" minus `days` days, as an ISO date. Uses UTC maths so time zones cannot shift it. */
export function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const moved = new Date(Date.UTC(year!, month! - 1, day! + days));
  return moved.toISOString().slice(0, 10);
}

/** The last `days` days up to and including `today`. */
export function periodRange(days: number, today: string): { start: string; end: string } {
  return { start: addDays(today, -(days - 1)), end: today };
}

/** "2026-10" -> "October 2026" */
export function formatMonth(key: string): string {
  const [year, month] = key.split("-").map(Number);
  if (!year || !month) return key;
  return new Date(year, month - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}
