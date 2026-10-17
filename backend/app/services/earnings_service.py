"""Earnings maths. Pure functions with no I/O, so they are easy to test.

Net earnings = gross earnings - work-related expenses.
"""

from dataclasses import dataclass
from datetime import date, timedelta

from ..schemas import DayBreakdown, SummaryOut, Totals, WeekInsights

WEEK_DAYS = 7
LOW_PAY_RATIO = 0.5  # a day is "low" if its net per hour is below half the week's average
MIN_DAYS_FOR_LOW_PAY = 3  # need a few worked days before comparing them


@dataclass(frozen=True)
class DayRow:
    """All entries for one calendar day, already added together."""

    entry_date: date
    gross: float
    expenses: float
    hours: float
    entries: int = 1


def net_earnings(gross: float, expenses: float) -> float:
    return round(gross - expenses, 2)


def _totals(rows: list[DayRow]) -> Totals:
    gross = sum(r.gross for r in rows)
    expenses = sum(r.expenses for r in rows)
    return Totals(
        gross=round(gross, 2),
        expenses=round(expenses, 2),
        net=net_earnings(gross, expenses),
        hours=round(sum(r.hours for r in rows), 2),
        entries=sum(r.entries for r in rows),
    )


def _day(day: date, row: DayRow | None) -> DayBreakdown:
    gross, expenses, hours = (row.gross, row.expenses, row.hours) if row else (0.0, 0.0, 0.0)
    return DayBreakdown(
        date=day,
        gross=round(gross, 2),
        expenses=round(expenses, 2),
        net=net_earnings(gross, expenses),
        hours=round(hours, 2),
    )


def _per_hour(net: float, hours: float) -> float | None:
    return round(net / hours, 2) if hours > 0 else None


def _week_insights(daily: list[DayBreakdown], week: Totals) -> WeekInsights:
    worked = [d for d in daily if d.hours > 0 or d.gross > 0]
    timed = [d for d in worked if d.hours > 0]
    week_rate = _per_hour(week.net, sum(d.hours for d in timed))

    low_days: list[date] = []
    if week_rate is not None and week_rate > 0 and len(timed) >= MIN_DAYS_FOR_LOW_PAY:
        low_days = [
            d.date for d in timed if (d.net / d.hours) < week_rate * LOW_PAY_RATIO
        ]

    return WeekInsights(
        days_worked=len(worked),
        avg_net_per_day=round(week.net / len(worked), 2) if worked else None,
        net_per_hour=week_rate,
        best_day=max(worked, key=lambda d: d.net) if worked else None,
        lowest_day=min(worked, key=lambda d: d.net) if worked else None,
        low_pay_days=low_days,
    )


def build_summary(week_rows: list[DayRow], all_time: Totals, today: date) -> SummaryOut:
    """Build the dashboard summary from stored data.

    `week_rows` holds per-day totals for the last 7 days; `all_time` is an aggregate
    computed by the database.
    """
    by_date = {r.entry_date: r for r in week_rows}
    days = [today - timedelta(days=offset) for offset in range(WEEK_DAYS - 1, -1, -1)]
    daily = [_day(d, by_date.get(d)) for d in days]
    week = _totals([by_date[d] for d in days if d in by_date])

    return SummaryOut(
        as_of=today,
        has_data=all_time.entries > 0,
        today=_totals([by_date[today]] if today in by_date else []),
        week=week,
        all_time=all_time,
        daily=daily,
        week_insights=_week_insights(daily, week),
    )
