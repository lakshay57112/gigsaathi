const rupees = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

export function formatINR(value: number): string {
  const sign = value < 0 ? "-" : "";
  return `${sign}₹${rupees.format(Math.abs(value))}`;
}

export function formatHours(value: number): string {
  return `${rupees.format(value)} h`;
}

/** Today's date in the user's own time zone, as YYYY-MM-DD (not UTC). */
export function localISODate(date: Date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** "2026-10-17" -> "17 Oct". Parsed by hand to avoid time-zone shifts. */
export function formatShortDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return new Date(year, month - 1, day).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/** "2026-10-17" -> "17 Oct 2026" */
export function formatLongDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return new Date(year, month - 1, day).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
