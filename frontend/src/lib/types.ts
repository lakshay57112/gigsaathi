// Shapes returned by the FastAPI backend (see backend/app/schemas.py).

export interface LanguageOption {
  code: string;
  name: string;
  native: string;
  speech_locale: string;
}

export interface Meta {
  app_name: string;
  ai: { configured: boolean; provider: string; model: string };
  languages: LanguageOption[];
  occupations: Record<string, string>;
  states: string[];
  max_document_chars: number;
  max_amount: number;
}

export interface EarningsEntry {
  id: number;
  entry_date: string;
  gross: number;
  hours: number;
  expenses: number;
  net: number;
  note: string;
}

export interface EarningsInput {
  entry_date: string;
  gross: number;
  hours: number;
  expenses: number;
  note: string;
}

export interface Totals {
  gross: number;
  expenses: number;
  net: number;
  hours: number;
  entries: number;
}

export interface DayBreakdown {
  date: string;
  gross: number;
  expenses: number;
  net: number;
  hours: number;
}

export interface Summary {
  as_of: string;
  has_data: boolean;
  today: Totals;
  week: Totals;
  all_time: Totals;
  daily: DayBreakdown[];
  week_insights: {
    days_worked: number;
    avg_net_per_day: number | null;
    net_per_hour: number | null;
    best_day: DayBreakdown | null;
    lowest_day: DayBreakdown | null;
    low_pay_days: string[];
  };
}

export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
}

export interface ChatResult {
  reply: string;
  used_earnings_data: boolean;
  used_scheme_data: boolean;
}

export interface LabeledValue {
  label: string;
  value: string;
}

export interface DocumentExplanation {
  summary: string;
  key_dates: LabeledValue[];
  amounts: LabeledValue[];
  action_items: string[];
  warnings: string[];
  platform_name: string | null;
}

export type IssueType =
  | "unpaid_payment"
  | "incentive_not_paid"
  | "unfair_deduction"
  | "account_blocked"
  | "penalty_or_rating"
  | "safety_incident"
  | "other";

export type Tone = "polite" | "professional" | "firm";

export interface GrievanceInput {
  issue_type: IssueType;
  platform: string;
  incident_date: string | null;
  amount: number | null;
  description: string;
  language: string;
  tone: Tone;
}

export interface GrievanceResult {
  subject: string;
  body: string;
  missing_details: string[];
}

export interface Scheme {
  id: string;
  name: string;
  summary: string;
  eligibility: string[];
  documents: string[];
  benefits: string[];
  how_to_apply: string;
  official_url: string | null;
  source_title: string;
  source_url: string;
  last_verified: string;
  verification_status: "verified" | "partially_verified" | "unverified";
  unverified_notes: string[];
}

export interface SchemeResult {
  occupation: string;
  state: string;
  schemes: Scheme[];
  notes: string[];
}

export interface SafetyContent {
  disclaimer: string;
  emergency: {
    title: string;
    can_app_call_for_help: boolean;
    numbers: { label: string; number: string }[];
  };
  sections: { id: string; title: string; tips: string[] }[];
}
