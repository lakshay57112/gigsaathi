import type { DocumentExplanation, IssueType } from "./types";

const KEY = "gs.grievancePrefill";

export interface GrievancePrefill {
  platform: string;
  amount: string;
  incident_date: string;
  description: string;
  issue_type: IssueType;
}

/** "Rs 1,500.50" -> "1500.5". Returns "" when no number is found. */
export function parseAmount(text: string): string {
  const match = text.replace(/,/g, "").match(/\d+(?:\.\d+)?/);
  return match ? String(Number(match[0])) : "";
}

/** Convert a date written in a document to YYYY-MM-DD, or "" if unclear or in the future. */
export function parseIncidentDate(text: string, todayISO: string): string {
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return "";
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  const iso = `${parsed.getFullYear()}-${month}-${day}`;
  return iso <= todayISO ? iso : "";
}

export function guessIssueType(text: string): IssueType {
  const lower = text.toLowerCase();
  if (/deduct/.test(lower)) return "unfair_deduction";
  if (/incentive|bonus/.test(lower)) return "incentive_not_paid";
  if (/block|suspend|deactivat|terminat/.test(lower)) return "account_blocked";
  if (/penalt|rating|fine/.test(lower)) return "penalty_or_rating";
  return "other";
}

/** Turn a document explanation into starting values for the grievance form. The worker reviews them. */
export function buildGrievancePrefill(doc: DocumentExplanation, todayISO: string): GrievancePrefill {
  return {
    platform: doc.platform_name ?? "",
    amount: doc.amounts[0] ? parseAmount(doc.amounts[0].value) : "",
    incident_date: doc.key_dates[0] ? parseIncidentDate(doc.key_dates[0].value, todayISO) : "",
    description: doc.summary,
    issue_type: guessIssueType(doc.summary),
  };
}

export function savePrefill(prefill: GrievancePrefill): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(prefill));
  } catch {
    // storage unavailable: the form simply opens empty
  }
}

export function takePrefill(): GrievancePrefill | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    return JSON.parse(raw) as GrievancePrefill;
  } catch {
    return null;
  }
}
