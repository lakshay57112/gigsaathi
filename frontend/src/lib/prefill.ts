import { formatINR } from "./format";
import type { DocumentExplanation, IssueType, PayoutCheck } from "./types";

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

/** Lines on the slip worth asking about: flagged by the reader, or repeated. */
export function flaggedLines(result: PayoutCheck) {
  return result.deductions.filter((line) => line.ask_about || line.duplicate);
}

/** True when there is something concrete to complain about. */
export function payoutNeedsComplaint(result: PayoutCheck): boolean {
  return flaggedLines(result).length > 0 || result.adds_up === false;
}

/**
 * Starting values for a complaint about a payout slip. Only facts from the slip are used,
 * and the worker reviews the text before sending.
 */
export function buildPayoutPrefill(result: PayoutCheck): GrievancePrefill {
  const flagged = flaggedLines(result);
  const parts: string[] = [];
  const period = result.period ? ` for ${result.period}` : "";

  if (flagged.length > 0) {
    const list = flagged.map((l) => (l.amount !== null ? `${l.label} (${formatINR(l.amount)})` : l.label)).join(", ");
    parts.push(
      `My payout slip${period} shows deductions I do not understand: ${list}. Please explain each one, and return the money if it was charged by mistake.`,
    );
  }
  if (result.adds_up === false && result.total_earned !== null && result.paid_out !== null && result.expected_payout !== null) {
    parts.push(
      `The slip says I earned ${formatINR(result.total_earned)} and lists deductions of ${formatINR(result.deductions_total ?? 0)}, so I expected ${formatINR(result.expected_payout)}, but I was paid ${formatINR(result.paid_out)}.`,
    );
  }

  const flaggedTotal = flagged.reduce((sum, l) => sum + (l.amount ?? 0), 0);
  return {
    platform: result.platform_name ?? "",
    amount: flaggedTotal > 0 ? String(flaggedTotal) : "",
    incident_date: "",
    description: parts.join(" "),
    issue_type: "unfair_deduction",
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
