import { formatINR, formatShortDate } from "./format";
import type { Summary } from "./types";

/**
 * A plain-English weekly summary built only from stored numbers. It works without AI;
 * the AI button on the dashboard re-words the same data in the worker's language.
 */
export function buildWeeklySummary(summary: Summary): string {
  const { week, week_insights: insights } = summary;
  if (week.entries === 0) return "No earnings were recorded in the last 7 days.";

  const parts = [
    `In the last 7 days you worked ${insights.days_worked} ${insights.days_worked === 1 ? "day" : "days"} ` +
      `(${week.hours} hours) and earned ${formatINR(week.gross)}. ` +
      `Work costs were ${formatINR(week.expenses)}, so your net earnings are ${formatINR(week.net)}.`,
  ];
  if (insights.net_per_hour !== null) parts.push(`That is about ${formatINR(insights.net_per_hour)} per hour after costs.`);
  if (insights.best_day) parts.push(`Your best day was ${formatShortDate(insights.best_day.date)} (${formatINR(insights.best_day.net)} net).`);
  if (insights.low_pay_days.length > 0) {
    parts.push(`Low-pay days compared with your week: ${insights.low_pay_days.map(formatShortDate).join(", ")}.`);
  }
  return parts.join(" ");
}
