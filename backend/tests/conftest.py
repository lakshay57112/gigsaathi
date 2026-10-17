"""Shared fixtures. No test ever calls the real Gemini API: the HTTP transport is faked."""

import sys
from collections.abc import Callable
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import deps  # noqa: E402
from app.config import Settings  # noqa: E402
from app.main import create_app  # noqa: E402
from app.services.ai_service import AIService  # noqa: E402
from app.services.rate_limit import SlidingWindowLimiter  # noqa: E402

DEVICE = "device-aaaaaaaaaaaaaaaa"
OTHER_DEVICE = "device-bbbbbbbbbbbbbbbb"

Handler = Callable[[httpx.Request], httpx.Response]


def gemini_text(text: str) -> httpx.Response:
    return httpx.Response(200, json={"candidates": [{"content": {"parts": [{"text": text}]}}]})


def gemini_call(name: str, args: dict | None = None) -> httpx.Response:
    part = {"functionCall": {"name": name, "args": args or {}}}
    return httpx.Response(200, json={"candidates": [{"content": {"parts": [part]}}]})


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return Settings(
        _env_file=None,
        gemini_api_key="test-key",
        gemini_retry_delay_seconds=0,
        database_path=str(tmp_path / "test.db"),
        static_dir=str(tmp_path / "no-frontend"),
        ai_rate_limit_per_minute=5,
    )


@pytest.fixture
def make_client(settings: Settings) -> Callable[..., TestClient]:
    """Build a client whose AI provider answers with `handler` (or is unconfigured)."""

    def build(handler: Handler | None = None, configured: bool = True, **overrides: object) -> TestClient:
        active = settings if configured else settings.model_copy(update={"gemini_api_key": ""})
        if overrides:
            active = active.model_copy(update=overrides)
        app = create_app(active)
        transport = httpx.MockTransport(handler or (lambda request: gemini_text("ok")))
        ai = AIService(active, transport=transport)
        app.dependency_overrides[deps.get_ai_service] = lambda: ai
        device = SlidingWindowLimiter(active.ai_rate_limit_per_minute)
        app.dependency_overrides[deps.get_device_limiter] = lambda: device
        by_ip = SlidingWindowLimiter(active.ai_ip_rate_limit_per_minute)
        app.dependency_overrides[deps.get_ip_limiter] = lambda: by_ip
        overall = SlidingWindowLimiter(active.ai_global_rate_limit_per_minute)
        app.dependency_overrides[deps.get_global_limiter] = lambda: overall
        client = TestClient(app, headers={"X-Device-Id": DEVICE})
        return client

    return build


@pytest.fixture
def client(make_client: Callable[..., TestClient]) -> TestClient:
    return make_client()


def entry(**overrides: object) -> dict:
    from datetime import date

    base = {"entry_date": date.today().isoformat(), "gross": 800, "hours": 8, "expenses": 150, "note": ""}
    return {**base, **overrides}
