"""Earnings maths: net = gross - expenses, weekly window, and low-pay detection."""

from datetime import date, timedelta

from app.schemas import Totals
from app.services.earnings_service import DayRow, build_summary, net_earnings

TODAY = date(2026, 10, 17)
EMPTY = Totals(gross=0, expenses=0, net=0, hours=0, entries=0)


def row(days_ago: int, gross: float, expenses: float, hours: float, entries: int = 1) -> DayRow:
    return DayRow(TODAY - timedelta(days=days_ago), gross, expenses, hours, entries)


def test_net_earnings_is_gross_minus_expenses():
    assert net_earnings(800, 150) == 650
    assert net_earnings(100, 250.5) == -150.5  # a loss-making day is allowed
    assert net_earnings(0.1 + 0.2, 0) == 0.3  # no floating-point noise


def test_empty_summary_has_no_data_and_no_division_errors():
    summary = build_summary([], EMPTY, TODAY)
    assert summary.has_data is False
    assert summary.week.net == 0
    assert summary.week_insights.net_per_hour is None
    assert summary.week_insights.best_day is None
    assert len(summary.daily) == 7


def test_today_and_week_totals():
    rows = [row(0, 800, 150, 8), row(1, 600, 100, 6), row(3, 500, 50, 5)]
    summary = build_summary(rows, Totals(gross=1900, expenses=300, net=1600, hours=19, entries=3), TODAY)
    assert (summary.today.gross, summary.today.expenses, summary.today.net) == (800, 150, 650)
    assert summary.week.gross == 1900
    assert summary.week.net == 1600
    assert summary.week.hours == 19


def test_week_only_counts_last_seven_days():
    rows = [row(0, 100, 0, 1), row(6, 100, 0, 1), row(7, 999, 0, 9)]  # day 7 is outside
    summary = build_summary(rows, EMPTY, TODAY)
    assert summary.week.gross == 200
    assert summary.daily[0].date == TODAY - timedelta(days=6)
    assert summary.daily[-1].date == TODAY


def test_multiple_entries_for_a_day_are_added_together():
    summary = build_summary([row(0, 700, 120, 7, entries=2)], EMPTY, TODAY)
    assert summary.today.entries == 2
    assert summary.today.net == 580


def test_net_per_hour_and_best_and_lowest_day():
    rows = [row(0, 800, 200, 6), row(1, 400, 100, 6), row(2, 1000, 100, 8)]
    insights = build_summary(rows, EMPTY, TODAY).week_insights
    assert insights.days_worked == 3
    assert insights.net_per_hour == round((600 + 300 + 900) / 20, 2)
    assert insights.best_day.net == 900
    assert insights.lowest_day.net == 300


def test_low_pay_days_flagged_only_when_well_below_average():
    rows = [row(0, 1000, 100, 8), row(1, 1000, 100, 8), row(2, 1000, 100, 8), row(3, 120, 100, 8)]
    insights = build_summary(rows, EMPTY, TODAY).week_insights
    assert insights.low_pay_days == [TODAY - timedelta(days=3)]


def test_low_pay_needs_at_least_three_worked_days():
    rows = [row(0, 1000, 100, 8), row(1, 120, 100, 8)]
    assert build_summary(rows, EMPTY, TODAY).week_insights.low_pay_days == []
