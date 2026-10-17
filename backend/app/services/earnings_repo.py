"""Database access for earnings. Every function takes a device id: one user never sees another's rows."""

import sqlite3
from datetime import date, timedelta

from ..schemas import EarningsIn, EarningsOut, SummaryOut, Totals
from . import earnings_service
from .earnings_service import DayRow


def _to_out(row: sqlite3.Row) -> EarningsOut:
    return EarningsOut(
        id=row["id"],
        entry_date=row["entry_date"],
        gross=row["gross"],
        hours=row["hours"],
        expenses=row["expenses"],
        net=earnings_service.net_earnings(row["gross"], row["expenses"]),
        note=row["note"],
    )


def add_entry(db: sqlite3.Connection, device_id: str, entry: EarningsIn) -> EarningsOut:
    cursor = db.execute(
        "INSERT INTO earnings (device_id, entry_date, gross, hours, expenses, note) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (device_id, entry.entry_date.isoformat(), entry.gross, entry.hours, entry.expenses, entry.note),
    )
    db.commit()
    row = db.execute("SELECT * FROM earnings WHERE id = ?", (cursor.lastrowid,)).fetchone()
    return _to_out(row)


def list_entries(db: sqlite3.Connection, device_id: str, limit: int) -> list[EarningsOut]:
    rows = db.execute(
        "SELECT * FROM earnings WHERE device_id = ? ORDER BY entry_date DESC, id DESC LIMIT ?",
        (device_id, limit),
    ).fetchall()
    return [_to_out(r) for r in rows]


def delete_entry(db: sqlite3.Connection, device_id: str, entry_id: int) -> bool:
    cursor = db.execute("DELETE FROM earnings WHERE id = ? AND device_id = ?", (entry_id, device_id))
    db.commit()
    return cursor.rowcount > 0


def delete_all(db: sqlite3.Connection, device_id: str) -> int:
    cursor = db.execute("DELETE FROM earnings WHERE device_id = ?", (device_id,))
    db.commit()
    return cursor.rowcount


def get_summary(db: sqlite3.Connection, device_id: str, today: date) -> SummaryOut:
    """Two aggregate queries: per-day rows for the last 7 days, and an all-time total."""
    week_start = today - timedelta(days=earnings_service.WEEK_DAYS - 1)
    week_rows = [
        DayRow(
            entry_date=date.fromisoformat(r["entry_date"]),
            gross=r["gross"],
            expenses=r["expenses"],
            hours=r["hours"],
            entries=r["entries"],
        )
        for r in db.execute(
            "SELECT entry_date, SUM(gross) AS gross, SUM(expenses) AS expenses, "
            "SUM(hours) AS hours, COUNT(*) AS entries FROM earnings "
            "WHERE device_id = ? AND entry_date BETWEEN ? AND ? GROUP BY entry_date",
            (device_id, week_start.isoformat(), today.isoformat()),
        )
    ]
    total = db.execute(
        "SELECT COALESCE(SUM(gross), 0) AS gross, COALESCE(SUM(expenses), 0) AS expenses, "
        "COALESCE(SUM(hours), 0) AS hours, COUNT(*) AS entries FROM earnings WHERE device_id = ?",
        (device_id,),
    ).fetchone()
    all_time = Totals(
        gross=round(total["gross"], 2),
        expenses=round(total["expenses"], 2),
        net=earnings_service.net_earnings(total["gross"], total["expenses"]),
        hours=round(total["hours"], 2),
        entries=total["entries"],
    )
    return earnings_service.build_summary(week_rows, all_time, today)
