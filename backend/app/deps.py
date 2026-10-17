"""FastAPI dependencies: settings, database, device identity, AI service and rate limits."""

import re
import sqlite3
from collections.abc import Iterator
from datetime import date, datetime
from functools import lru_cache
from zoneinfo import ZoneInfo

from fastapi import Depends, Header, HTTPException, Request

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
def get_ip_limiter() -> SlidingWindowLimiter:
    return SlidingWindowLimiter(get_settings().ai_ip_rate_limit_per_minute)


def client_ip(request: Request, settings: Settings = Depends(get_settings)) -> str:
    """Caller address. Behind a trusted proxy the last X-Forwarded-For entry is the one
    the proxy itself added, so it cannot be forged by the client."""
    if settings.trust_forwarded_for:
        forwarded = request.headers.get("x-forwarded-for", "")
        last = forwarded.split(",")[-1].strip()
        if last:
            return last
    return request.client.host if request.client else "unknown"


@lru_cache
def get_global_limiter() -> SlidingWindowLimiter:
    return SlidingWindowLimiter(get_settings().ai_global_rate_limit_per_minute)


def rate_limit_ai(
    device_id: str = Depends(get_device_id),
    ip: str = Depends(client_ip),
    ip_limiter: SlidingWindowLimiter = Depends(get_ip_limiter),
    device_limiter: SlidingWindowLimiter = Depends(get_device_limiter),
    global_limiter: SlidingWindowLimiter = Depends(get_global_limiter),
) -> None:
    """Limit AI calls per IP, per device and across the server, to protect the API key.

    The IP check comes first so one noisy address cannot use up the shared quota, and
    inventing new device ids does not get around it."""
    wait = ip_limiter.check(ip) or device_limiter.check(device_id) or global_limiter.check("all")
    if wait:
        raise HTTPException(
            status_code=429,
            detail="Too many AI requests. Please wait a moment and try again.",
            headers={"Retry-After": str(wait)},
        )
