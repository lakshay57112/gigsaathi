"""FastAPI dependencies: settings, database, device identity, AI service and rate limits."""

import re
import sqlite3
from collections.abc import Iterator
from datetime import date, datetime
from functools import lru_cache
from zoneinfo import ZoneInfo

from fastapi import Depends, Header, HTTPException

from .config import Settings, get_settings
from .database import connection_scope
from .services.ai_service import AIService
from .services.rate_limit import SlidingWindowLimiter

_DEVICE_ID = re.compile(r"^[A-Za-z0-9-]{16,64}$")


def get_db(settings: Settings = Depends(get_settings)) -> Iterator[sqlite3.Connection]:
    yield from connection_scope(settings.database_path)


def get_device_id(x_device_id: str | None = Header(default=None)) -> str:
    """Anonymous per-browser id. There are no accounts; the id scopes every query."""
    if not x_device_id or not _DEVICE_ID.fullmatch(x_device_id):
        raise HTTPException(status_code=400, detail="Missing or invalid X-Device-Id header.")
    return x_device_id


def today_for(settings: Settings) -> date:
    return datetime.now(ZoneInfo(settings.app_timezone)).date()


def get_today(settings: Settings = Depends(get_settings)) -> date:
    return today_for(settings)


@lru_cache
def get_ai_service() -> AIService:
    return AIService(get_settings())


@lru_cache
def get_device_limiter() -> SlidingWindowLimiter:
    return SlidingWindowLimiter(get_settings().ai_rate_limit_per_minute)


@lru_cache
def get_global_limiter() -> SlidingWindowLimiter:
    return SlidingWindowLimiter(get_settings().ai_global_rate_limit_per_minute)


def rate_limit_ai(
    device_id: str = Depends(get_device_id),
    device_limiter: SlidingWindowLimiter = Depends(get_device_limiter),
    global_limiter: SlidingWindowLimiter = Depends(get_global_limiter),
) -> None:
    """Limit AI calls per device and across the whole server, to protect the API key."""
    wait = device_limiter.check(device_id) or global_limiter.check("all")
    if wait:
        raise HTTPException(
            status_code=429,
            detail="Too many AI requests. Please wait a moment and try again.",
            headers={"Retry-After": str(wait)},
        )
