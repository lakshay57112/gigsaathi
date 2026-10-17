// Form checks that mirror the backend rules, so mistakes are caught before sending.

export interface EarningsForm {
  entry_date: string;
  gross: string;
  hours: string;
  expenses: string;
  note: string;
}

export type FormErrors<K extends string> = Partial<Record<K, string>>;

function parseNumber(raw: string): number | null {
  if (raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function validateEarnings(
  form: EarningsForm,
  maxAmount: number,
  todayISO: string,
): FormErrors<keyof EarningsForm> {
  const errors: FormErrors<keyof EarningsForm> = {};

  if (!form.entry_date) errors.entry_date = "Choose a date.";
  else if (form.entry_date > todayISO) errors.entry_date = "The date cannot be in the future.";

  const gross = parseNumber(form.gross);
  if (gross === null) errors.gross = "Enter the amount you earned, for example 800.";
  else if (gross < 0) errors.gross = "Earnings cannot be negative.";
  else if (gross > maxAmount) errors.gross = "That amount looks too large. Please check it.";

  const hours = parseNumber(form.hours);
  if (hours === null) errors.hours = "Enter the hours you worked, for example 8.";
  else if (hours < 0) errors.hours = "Hours cannot be negative.";
  else if (hours > 24) errors.hours = "A day has only 24 hours.";

  const expenses = parseNumber(form.expenses);
  if (expenses === null) errors.expenses = "Enter your expenses, or 0 if none.";
  else if (expenses < 0) errors.expenses = "Expenses cannot be negative.";
  else if (expenses > maxAmount) errors.expenses = "That amount looks too large. Please check it.";

  if (form.note.length > 200) errors.note = "Keep the note under 200 characters.";
  return errors;
}

export function toNumber(raw: string): number {
  return Number(raw);
}
