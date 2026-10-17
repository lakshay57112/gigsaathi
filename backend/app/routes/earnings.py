"""Earnings tracking: add, list, delete, and the dashboard summary."""

import sqlite3
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Response

from ..config import Settings, get_settings
from ..deps import get_db, get_device_id, get_today
from ..schemas import EarningsIn, EarningsOut, SummaryOut
from ..services import earnings_repo

router = APIRouter(prefix="/api", tags=["earnings"])

MAX_PAST_DAYS = 366


def validate_entry_date(entry_date: date, today: date) -> None:
    if entry_date > today:
        raise HTTPException(status_code=422, detail="The date cannot be in the future.")
    if entry_date < today - timedelta(days=MAX_PAST_DAYS):
        raise HTTPException(status_code=422, detail="The date is more than a year ago.")


@router.post("/earnings", response_model=EarningsOut, status_code=201)
def add_earnings(
    entry: EarningsIn,
    db: sqlite3.Connection = Depends(get_db),
    device_id: str = Depends(get_device_id),
    today: date = Depends(get_today),
    settings: Settings = Depends(get_settings),
) -> EarningsOut:
    validate_entry_date(entry.entry_date, today)
    if earnings_repo.count_entries(db, device_id) >= settings.max_entries_per_device:
        raise HTTPException(
            status_code=409,
            detail="You have reached the limit of saved entries. Delete old ones to add more.",
        )
    return earnings_repo.add_entry(db, device_id, entry)


@router.get("/earnings", response_model=list[EarningsOut])
def list_earnings(
    limit: int = Query(default=30, ge=1, le=100),
    db: sqlite3.Connection = Depends(get_db),
    device_id: str = Depends(get_device_id),
) -> list[EarningsOut]:
    return earnings_repo.list_entries(db, device_id, limit)


@router.delete("/earnings/{entry_id}", status_code=204)
def delete_earning(
    entry_id: int,
    db: sqlite3.Connection = Depends(get_db),
    device_id: str = Depends(get_device_id),
) -> Response:
    if not earnings_repo.delete_entry(db, device_id, entry_id):
        raise HTTPException(status_code=404, detail="Entry not found.")
    return Response(status_code=204)


@router.delete("/earnings", status_code=204)
def delete_all_earnings(
    db: sqlite3.Connection = Depends(get_db),
    device_id: str = Depends(get_device_id),
) -> Response:
    earnings_repo.delete_all(db, device_id)
    return Response(status_code=204)


@router.get("/summary", response_model=SummaryOut)
def get_summary(
    db: sqlite3.Connection = Depends(get_db),
    device_id: str = Depends(get_device_id),
    today: date = Depends(get_today),
) -> SummaryOut:
    return earnings_repo.get_summary(db, device_id, today)
