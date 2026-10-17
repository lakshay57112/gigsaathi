import { describe, expect, it } from "vitest";
import { parseErrorBody } from "./api";
import { deleteDraft, loadDrafts, MAX_DRAFTS, saveDraft } from "./drafts";
import { formatINR, formatShortDate, localISODate } from "./format";
import { englishKeys, hindiKeys, translate } from "./i18n";
import { buildGrievancePrefill, buildPayoutPrefill, guessIssueType, parseAmount, parseIncidentDate, payoutNeedsComplaint } from "./prefill";
import { LANGUAGE_KEY, needsLanguageChoice, readStoredLanguage } from "./languagePref";
import { buildWhatsAppUrl } from "./share";
import { parseHash } from "./route";
import { addDays, formatMonth, PERIODS, periodRange } from "./statementPeriod";
import { buildWeeklySummary } from "./summary";
import { cleanAiText } from "./text";
import type { DocumentExplanation, PayoutCheck, Summary } from "./types";
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

describe("language choice", () => {
  const fakeStorage = (initial: Record<string, string> = {}) => {
    const data = { ...initial };
    return {
      getItem: (k: string) => data[k] ?? null,
      setItem: (k: string, v: string) => {
        data[k] = v;
      },
    };
  };

  it("asks on the first visit and not after a language is saved", () => {
    expect(needsLanguageChoice(fakeStorage())).toBe(true);
    expect(needsLanguageChoice(fakeStorage({ [LANGUAGE_KEY]: "ta" }))).toBe(false);
  });

  it("reads back the saved language", () => {
    expect(readStoredLanguage(fakeStorage({ [LANGUAGE_KEY]: "ta" }))).toBe("ta");
    expect(readStoredLanguage(fakeStorage())).toBeNull();
    expect(readStoredLanguage(null)).toBeNull();
  });

  it("skips the screen when storage is blocked, since the answer could not be remembered", () => {
    const blocked = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(needsLanguageChoice(blocked)).toBe(false);
    expect(needsLanguageChoice(null)).toBe(false);
    expect(readStoredLanguage(blocked)).toBeNull();
  });
});

describe("statement periods", () => {
  it("covers exactly the chosen number of days, ending today", () => {
    expect(periodRange(30, "2026-10-17")).toEqual({ start: "2026-09-18", end: "2026-10-17" });
    expect(periodRange(1, "2026-10-17")).toEqual({ start: "2026-10-17", end: "2026-10-17" });
  });

  it("handles month and year boundaries and leap years", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2028-03-01", -1)).toBe("2028-02-29");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(periodRange(365, "2026-10-17").start).toBe("2025-10-18");
  });

  it("never asks for more than the server allows (a year)", () => {
    for (const p of PERIODS) expect(p.days).toBeLessThanOrEqual(366);
  });

  it("formats month keys for display", () => {
    expect(formatMonth("2026-10")).toBe("October 2026");
    expect(formatMonth("bad")).toBe("bad");
  });
});

describe("whatsapp share", () => {
  it("builds a link carrying the encoded text", () => {
    const url = buildWhatsAppUrl("Payment not received\n\nHello & thanks");
    expect(url).toBe("https://wa.me/?text=" + encodeURIComponent("Payment not received\n\nHello & thanks"));
    expect(url).not.toContain(" ");
  });

  it("returns null for empty or too-long text so the caller can copy instead", () => {
    expect(buildWhatsAppUrl("   ")).toBeNull();
    expect(buildWhatsAppUrl("a".repeat(5000))).toBeNull();
    expect(buildWhatsAppUrl("अ".repeat(500))).toBeNull(); // Hindi letters expand when encoded
    expect(buildWhatsAppUrl("a".repeat(1500))).not.toBeNull();
  });
});

describe("payout complaint", () => {
  const base: PayoutCheck = {
    summary: "Weekly payout.",
    period: "3-9 Oct",
    platform_name: "FastRide",
    total_earned: 5000,
    paid_out: 3500,
    deductions: [
      { label: "Platform fee", amount: 500, plain_meaning: "", ask_about: false, reason: "", duplicate: false },
      { label: "Penalty", amount: 300, plain_meaning: "", ask_about: true, reason: "", duplicate: false },
      { label: "Misc adjustment", amount: 200, plain_meaning: "", ask_about: false, reason: "", duplicate: true },
    ],
    deductions_total: 1000,
    expected_payout: 4000,
    difference: -500,
    adds_up: false,
    questions_to_ask: [],
    warnings: [],
  };

  it("uses only facts from the slip and lists just the lines worth asking about", () => {
    const prefill = buildPayoutPrefill(base);
    expect(prefill.issue_type).toBe("unfair_deduction");
    expect(prefill.platform).toBe("FastRide");
    expect(prefill.amount).toBe("500");
    expect(prefill.description).toContain("Penalty (₹300)");
    expect(prefill.description).toContain("Misc adjustment (₹200)");
    expect(prefill.description).not.toContain("Platform fee");
    expect(prefill.description).toContain("I expected ₹4,000, but I was paid ₹3,500");
  });

  it("offers a complaint only when something is flagged or the slip does not add up", () => {
    expect(payoutNeedsComplaint(base)).toBe(true);
    const clean = { ...base, adds_up: true, deductions: [base.deductions[0]!] };
    expect(payoutNeedsComplaint(clean)).toBe(false);
    expect(payoutNeedsComplaint({ ...clean, adds_up: null })).toBe(false);
    expect(payoutNeedsComplaint({ ...clean, adds_up: false })).toBe(true);
  });

  it("does not mention the totals when the slip adds up", () => {
    const description = buildPayoutPrefill({ ...base, adds_up: true, difference: 0 }).description;
    expect(description).not.toContain("I expected");
  });
});
