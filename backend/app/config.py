"""Application settings, read from environment variables (and an optional .env file)."""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_DIR = BACKEND_DIR.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=PROJECT_DIR / ".env", extra="ignore")

    app_name: str = "GigSaathi"

    # AI provider (Google Gemini). Leave the key empty to run without AI.
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.8-flash"
    gemini_timeout_seconds: float = 30.0
    gemini_retry_delay_seconds: float = 0.5

    database_path: str = str(BACKEND_DIR / "gigsaathi.db")
    app_timezone: str = "Asia/Kolkata"

    # Rate limits protect the AI key from abuse.
    ai_rate_limit_per_minute: int = 10
    ai_ip_rate_limit_per_minute: int = 20
    ai_global_rate_limit_per_minute: int = 120
    trust_forwarded_for: bool = True  # set false if the app is exposed without a proxy

    max_request_bytes: int = 65_536
    static_dir: str = str(PROJECT_DIR / "frontend" / "dist")
    cors_origins: str = ""  # comma-separated; only needed for local frontend dev


@lru_cache
def get_settings() -> Settings:
    return Settings()
