"""Income statement: totals, month rows, period checks and device isolation."""

from datetime import date, timedelta

from app.schemas import EarningsOut
from app.services.earnings_service import build_statement
from conftest import OTHER_DEVICE, entry


def _today(client) -> date:
    return date.fromisoformat(client.get("/api/summary").json()["as_of"])


def _row(i: int, day: date, gross: float, expenses: float, hours: float) -> EarningsOut:
    return EarningsOut(id=i, entry_date=day, gross=gross, hours=hours, expenses=expenses, net=gross - expenses, note="")


def test_build_statement_adds_up_and_groups_by_month():
    entries = [
        _row(1, date(2026, 9, 29), 1000, 200, 8),
        _row(2, date(2026, 10, 1), 900, 100, 7),
        _row(3, date(2026, 10, 1), 300, 50, 2),  # second entry on the same day
        _row(4, date(2026, 10, 3), 500, 0, 4),
    ]
    statement = build_statement(entries, date(2026, 9, 1), date(2026, 10, 15), date(2026, 10, 15))
    assert statement.totals.gross == 2700
    assert statement.totals.expenses == 350
    assert statement.totals.net == 2350
    assert statement.totals.hours == 21
    assert statement.days_worked == 3
    sept, octo = statement.months
    assert (sept.month, sept.net, sept.days_worked) == ("2026-09", 800, 1)
    assert (octo.month, octo.net, octo.days_worked) == ("2026-10", 1550, 2)
    assert sum(m.net for m in statement.months) == statement.totals.net


def test_build_statement_for_a_period_with_no_entries():
    statement = build_statement([], date(2026, 10, 1), date(2026, 10, 15), date(2026, 10, 15))
    assert statement.totals.net == 0
    assert statement.months == []
    assert statement.entries == []


def test_statement_endpoint_returns_only_the_period(client):
    today = _today(client)
    old = today - timedelta(days=40)
    client.post("/api/earnings", json=entry(entry_date=today.isoformat(), gross=800, expenses=150, hours=8))
    client.post("/api/earnings", json=entry(entry_date=old.isoformat(), gross=500, expenses=100, hours=5))

    last_week = client.get("/api/statement", params={"start": (today - timedelta(days=6)).isoformat(), "end": today.isoformat()})
    assert last_week.status_code == 200
    body = last_week.json()
    assert body["totals"]["net"] == 650
    assert len(body["entries"]) == 1

    last_two_months = client.get("/api/statement", params={"start": (today - timedelta(days=60)).isoformat(), "end": today.isoformat()}).json()
    assert last_two_months["totals"]["net"] == 1050
    assert last_two_months["days_worked"] == 2
    assert [e["entry_date"] for e in last_two_months["entries"]] == [old.isoformat(), today.isoformat()]


def test_statement_checks_the_period(client):
    today = _today(client)
    get = lambda s, e: client.get("/api/statement", params={"start": s.isoformat(), "end": e.isoformat()})  # noqa: E731
    assert get(today, today - timedelta(days=1)).status_code == 422
    assert get(today, today + timedelta(days=1)).status_code == 422
    assert get(today - timedelta(days=400), today).status_code == 422
    assert get(today - timedelta(days=365), today).status_code == 200
    assert client.get("/api/statement", params={"start": "nope", "end": "2026-01-01"}).status_code == 422


def test_statement_only_shows_the_callers_own_entries(client):
    today = _today(client)
    client.post("/api/earnings", json=entry(gross=800, expenses=150))
    other = client.get(
        "/api/statement",
        params={"start": today.isoformat(), "end": today.isoformat()},
        headers={"X-Device-Id": OTHER_DEVICE},
    ).json()
    assert other["entries"] == []
    assert other["totals"]["net"] == 0
