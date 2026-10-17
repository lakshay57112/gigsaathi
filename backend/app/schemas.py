"""Request and response models. Validation limits live here so the API is self-documenting."""

from datetime import date
from typing import Annotated, Literal

from pydantic import (
    AfterValidator,
    BaseModel,
    BeforeValidator,
    Field,
    StringConstraints,
    field_validator,
)

from .languages import LANGUAGES

MAX_AMOUNT = 1_000_000  # rupees; guards against typos like an extra zero or two
MAX_DOCUMENT_CHARS = 6000


def _check_language(value: str) -> str:
    if value not in LANGUAGES:
        raise ValueError("Unsupported language")
    return value


def _empty_list_if_none(value: object) -> object:
    return [] if value is None else value


Language = Annotated[str, AfterValidator(_check_language)]
ShortText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
Money = Annotated[float, Field(ge=0, le=MAX_AMOUNT, allow_inf_nan=False)]
TolerantList = Annotated[list[str], BeforeValidator(_empty_list_if_none)]


# ---- Earnings -------------------------------------------------------------------------


class EarningsIn(BaseModel):
    entry_date: date
    gross: Money
    hours: float = Field(ge=0, le=24, allow_inf_nan=False)
    expenses: Money
    note: str = Field(default="", max_length=200)

    @field_validator("gross", "hours", "expenses")
    @classmethod
    def _round(cls, value: float) -> float:
        return round(value, 2)

    @field_validator("note")
    @classmethod
    def _clean_note(cls, value: str) -> str:
        return "".join(ch for ch in value if ch.isprintable()).strip()


class EarningsOut(BaseModel):
    id: int
    entry_date: date
    gross: float
    hours: float
    expenses: float
    net: float
    note: str


class Totals(BaseModel):
    gross: float
    expenses: float
    net: float
    hours: float
    entries: int


class DayBreakdown(BaseModel):
    date: date
    gross: float
    expenses: float
    net: float
    hours: float


class WeekInsights(BaseModel):
    days_worked: int
    avg_net_per_day: float | None
    net_per_hour: float | None
    best_day: DayBreakdown | None
    lowest_day: DayBreakdown | None
    low_pay_days: list[date]


class SummaryOut(BaseModel):
    as_of: date
    has_data: bool
    today: Totals
    week: Totals  # the last 7 days, including today
    all_time: Totals
    daily: list[DayBreakdown]  # last 7 days, oldest first
    week_insights: WeekInsights


class MonthRow(BaseModel):
    month: str  # "2026-10"
    gross: float
    expenses: float
    net: float
    hours: float
    days_worked: int


class StatementOut(BaseModel):
    """A worker's own record of earnings for a period. Self-reported, not verified by anyone."""

    start: date
    end: date
    generated_on: date
    totals: Totals
    days_worked: int
    months: list[MonthRow]
    entries: list[EarningsOut]  # oldest first


# ---- AI features ----------------------------------------------------------------------


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    text: str = Field(min_length=1, max_length=2000)


class ChatRequest(BaseModel):
    message: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1000)]
    language: Language = "en"
    history: list[ChatTurn] = Field(default_factory=list, max_length=10)


class ChatResponse(BaseModel):
    reply: str
    used_earnings_data: bool
    used_scheme_data: bool


class LanguageRequest(BaseModel):
    language: Language = "en"


class ExplainResponse(BaseModel):
    text: str


class LabeledValue(BaseModel):
    label: str
    value: str


class DocumentRequest(BaseModel):
    text: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=20, max_length=MAX_DOCUMENT_CHARS)
    ]
    language: Language = "en"


class DocumentExplanation(BaseModel):
    """Shape the model must return. Lists default to empty so a partial answer still works."""

    summary: str
    key_dates: Annotated[list[LabeledValue], BeforeValidator(_empty_list_if_none)] = []
    amounts: Annotated[list[LabeledValue], BeforeValidator(_empty_list_if_none)] = []
    action_items: TolerantList = []
    warnings: TolerantList = []
    platform_name: str | None = None


def _amount_or_none(value: object) -> object:
    """Accept a number, or text like "Rs 1,200"; anything else (or a huge value) becomes None."""
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        number = float(value)
    else:
        digits = "".join(ch for ch in str(value) if ch.isdigit() or ch == ".")
        try:
            number = float(digits)
        except ValueError:
            return None
    return number if 0 <= number <= MAX_AMOUNT else None


OptionalAmount = Annotated[float | None, BeforeValidator(_amount_or_none)]


class PayoutLineModel(BaseModel):
    """One deduction as the model read it from the payout slip."""

    label: str
    amount: OptionalAmount = None
    plain_meaning: str = ""  # what this line usually means, in simple words
    ask_about: bool = False  # true when it has no clear reason, is vague, or is a penalty
    reason: str = ""  # why it is worth asking about


class PayoutExtraction(BaseModel):
    """Shape the model must return for a payout slip."""

    summary: str
    period: str | None = None
    platform_name: str | None = None
    total_earned: OptionalAmount = None  # before any deduction
    paid_out: OptionalAmount = None  # what was actually paid
    deductions: Annotated[list[PayoutLineModel], BeforeValidator(_empty_list_if_none)] = []
    questions_to_ask: TolerantList = []
    warnings: TolerantList = []


class PayoutLine(PayoutLineModel):
    duplicate: bool = False  # the same label and amount appears more than once


class PayoutCheck(BaseModel):
    """The slip as read by the model, plus the arithmetic worked out here in code."""

    summary: str
    period: str | None
    platform_name: str | None
    total_earned: float | None
    paid_out: float | None
    deductions: list[PayoutLine]
    deductions_total: float | None  # sum of the deductions that had an amount
    expected_payout: float | None  # total_earned - deductions_total
    difference: float | None  # paid_out - expected_payout (negative = paid less than expected)
    adds_up: bool | None  # None when the slip did not give enough numbers to check
    questions_to_ask: list[str]
    warnings: list[str]


IssueType = Literal[
    "unpaid_payment",
    "incentive_not_paid",
    "unfair_deduction",
    "account_blocked",
    "penalty_or_rating",
    "safety_incident",
    "other",
]
Tone = Literal["polite", "professional", "firm"]


class GrievanceRequest(BaseModel):
    issue_type: IssueType
    platform: ShortText
    incident_date: date | None = None
    amount: Money | None = None
    description: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=10, max_length=2000)
    ]
    language: Language = "en"
    tone: Tone = "professional"


class GrievanceDraft(BaseModel):
    subject: str
    body: str


class GrievanceResponse(GrievanceDraft):
    missing_details: list[str]


# ---- Reference data -------------------------------------------------------------------


class AIInfo(BaseModel):
    configured: bool
    provider: str
    model: str


class LanguageOut(BaseModel):
    code: str
    name: str
    native: str
    speech_locale: str


class MetaOut(BaseModel):
    app_name: str
    ai: AIInfo
    languages: list[LanguageOut]
    occupations: dict[str, str]
    states: list[str]
    max_document_chars: int
    max_amount: int
