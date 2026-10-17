import { describe, expect, it } from "vitest";
import { parseErrorBody } from "./api";
import { deleteDraft, loadDrafts, MAX_DRAFTS, saveDraft } from "./drafts";
import { formatINR, formatShortDate, localISODate } from "./format";
import { englishKeys, hindiKeys, translate } from "./i18n";
import { buildGrievancePrefill, guessIssueType, parseAmount, parseIncidentDate } from "./prefill";
import { parseHash } from "./route";
import { buildWeeklySummary } from "./summary";
import { cleanAiText } from "./text";
import type { DocumentExplanation, Summary } from "./types";
import { validateEarnings, type EarningsForm } from "./validation";

const TODAY = "2026-10-17";
const validForm: EarningsForm = { entry_date: TODAY, gross: "800", hours: "8", expenses: "150", note: "" };

describe("validateEarnings", () => {
  it("accepts a normal entry", () => {
    expect(validateEarnings(validForm, 1_000_000, TODAY)).toEqual({});
  });

  it("accepts a loss-making day and zero expenses", () => {
    expect(validateEarnings({ ...validForm, gross: "100", expenses: "400" }, 1_000_000, TODAY)).toEqual({});
    expect(validateEarnings({ ...validForm, expenses: "0" }, 1_000_000, TODAY)).toEqual({});
  });

  it("rejects empty, negative, huge and impossible values", () => {
    const errors = validateEarnings({ entry_date: "", gross: "", hours: "25", expenses: "-5", note: "" }, 1_000_000, TODAY);
    expect(Object.keys(errors).sort()).toEqual(["entry_date", "expenses", "gross", "hours"]);
    expect(validateEarnings({ ...validForm, gross: "2000000" }, 1_000_000, TODAY).gross).toBeDefined();
    expect(validateEarnings({ ...validForm, gross: "abc" }, 1_000_000, TODAY).gross).toBeDefined();
  });

  it("rejects future dates", () => {
    expect(validateEarnings({ ...validForm, entry_date: "2026-10-18" }, 1_000_000, TODAY).entry_date).toBeDefined();
  });
});

describe("parseErrorBody", () => {
  it("reads a plain message", () => {
    expect(parseErrorBody(400, { detail: "Bad." }).message).toBe("Bad.");
  });

  it("reads an AI error code and message", () => {
    const error = parseErrorBody(503, { detail: { code: "ai_not_configured", message: "No AI." } });
    expect(error.code).toBe("ai_not_configured");
    expect(error.message).toBe("No AI.");
  });

  it("maps validation errors onto fields", () => {
    const error = parseErrorBody(422, { detail: [{ field: "gross", message: "too big" }] });
    expect(error.fieldErrors).toEqual({ gross: "too big" });
  });

  it("falls back to a friendly message", () => {
    expect(parseErrorBody(500, null).message).toMatch(/try again/i);
    expect(parseErrorBody(413, {}).code).toBe("too_large");
  });
});

describe("formatting", () => {
  it("formats rupees in the Indian style", () => {
    expect(formatINR(1234567)).toBe("₹12,34,567");
    expect(formatINR(-50.5)).toBe("-₹50.5");
  });

  it("uses the local calendar date", () => {
    expect(localISODate(new Date(2026, 9, 7))).toBe("2026-10-07");
  });

  it("formats a short date without time-zone shifts", () => {
    expect(formatShortDate("2026-10-17")).toMatch(/17/);
  });
});

describe("i18n", () => {
  it("translates Hindi and falls back to English", () => {
    expect(translate("hi", "nav_earnings")).toBe("कमाई");
    expect(translate("ta", "nav_earnings")).toBe("Earnings");
  });

  it("has a Hindi string for every English key", () => {
    expect(englishKeys.filter((key) => !hindiKeys.includes(key))).toEqual([]);
  });
});

describe("document to grievance prefill", () => {
  const doc: DocumentExplanation = {
    summary: "Rs 500 will be deducted for late deliveries.",
    key_dates: [{ label: "Deduction date", value: "2026-10-01" }],
    amounts: [{ label: "Deduction", value: "Rs 1,500.50" }],
    action_items: [],
    warnings: [],
    platform_name: "QuickBite",
  };

  it("fills platform, amount, date and issue type", () => {
    expect(buildGrievancePrefill(doc, TODAY)).toEqual({
      platform: "QuickBite",
      amount: "1500.5",
      incident_date: "2026-10-01",
      description: doc.summary,
      issue_type: "unfair_deduction",
    });
  });

  it("leaves fields empty when the document has none", () => {
    const prefill = buildGrievancePrefill({ ...doc, key_dates: [], amounts: [], platform_name: null }, TODAY);
    expect(prefill.platform).toBe("");
    expect(prefill.amount).toBe("");
    expect(prefill.incident_date).toBe("");
  });

  it("never prefills a future incident date", () => {
    expect(parseIncidentDate("2026-12-25", TODAY)).toBe("");
    expect(parseIncidentDate("not a date", TODAY)).toBe("");
  });

  it("parses amounts and guesses the issue type", () => {
    expect(parseAmount("about Rs 250")).toBe("250");
    expect(parseAmount("no number")).toBe("");
    expect(guessIssueType("Your account was suspended")).toBe("account_blocked");
    expect(guessIssueType("Hello")).toBe("other");
  });
});

describe("local grievance drafts", () => {
  function fakeStorage() {
    const data = new Map<string, string>();
    return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
  }

  it("saves, lists and deletes drafts", () => {
    const storage = fakeStorage();
    const [first] = saveDraft({ platform: "A", subject: "s", body: "b" }, storage, new Date(1000));
    saveDraft({ platform: "B", subject: "s2", body: "b2" }, storage, new Date(2000));
    expect(loadDrafts(storage).map((d) => d.platform)).toEqual(["B", "A"]);
    expect(deleteDraft(first.id, storage).map((d) => d.platform)).toEqual(["B"]);
  });

  it("keeps only the most recent drafts", () => {
    const storage = fakeStorage();
    for (let i = 0; i < MAX_DRAFTS + 3; i++) saveDraft({ platform: `P${i}`, subject: "", body: "" }, storage, new Date(i));
    expect(loadDrafts(storage)).toHaveLength(MAX_DRAFTS);
  });

  it("survives corrupt or missing storage", () => {
    expect(loadDrafts({ getItem: () => "{not json", setItem: () => {} })).toEqual([]);
    expect(loadDrafts(null)).toEqual([]);
  });
});

describe("text and routes", () => {
  it("tidies markdown from AI text", () => {
    expect(cleanAiText("**Bold** point\n* one\n- two")).toBe("Bold point\n• one\n• two");
  });

  it("falls back to the dashboard for unknown routes", () => {
    expect(parseHash("#/earnings")).toBe("/earnings");
    expect(parseHash("#/nope")).toBe("/");
    expect(parseHash("")).toBe("/");
  });
});

describe("buildWeeklySummary", () => {
  const totals = { gross: 0, expenses: 0, net: 0, hours: 0, entries: 0 };
  const summary: Summary = {
    as_of: TODAY,
    has_data: true,
    today: totals,
    all_time: totals,
    daily: [],
    week: { gross: 3000, expenses: 600, net: 2400, hours: 30, entries: 4 },
    week_insights: {
      days_worked: 4,
      avg_net_per_day: 600,
      net_per_hour: 80,
      best_day: { date: "2026-10-15", gross: 1000, expenses: 100, net: 900, hours: 9 },
      lowest_day: null,
      low_pay_days: [],
    },
  };

  it("uses only the stored numbers", () => {
    const text = buildWeeklySummary(summary);
    expect(text).toContain("₹3,000");
    expect(text).toContain("₹2,400");
    expect(text).toContain("₹80 per hour");
  });

  it("says so when nothing is recorded", () => {
    expect(buildWeeklySummary({ ...summary, week: { ...summary.week, entries: 0 } })).toMatch(/No earnings/);
  });
});
