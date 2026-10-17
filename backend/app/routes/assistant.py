"""AI assistant chat, and the AI-written weekly summary."""

import json
import sqlite3
from datetime import date
from typing import Any

from fastapi import APIRouter, Depends

from ..deps import get_ai_service, get_db, get_device_id, get_today, rate_limit_ai
from ..languages import OCCUPATIONS, STATES
from ..schemas import ChatRequest, ChatResponse, ExplainResponse, LanguageRequest
from ..services import earnings_repo, scheme_service
from ..services.ai_service import AIService

router = APIRouter(prefix="/api", tags=["assistant"], dependencies=[Depends(rate_limit_ai)])


@router.post("/assistant/chat", response_model=ChatResponse)
async def chat(
    payload: ChatRequest,
    db: sqlite3.Connection = Depends(get_db),
    device_id: str = Depends(get_device_id),
    today: date = Depends(get_today),
    ai: AIService = Depends(get_ai_service),
) -> ChatResponse:
    used: set[str] = set()

    def earnings_tool(_args: dict[str, Any]) -> dict[str, Any]:
        used.add("earnings")
        return earnings_repo.get_summary(db, device_id, today).model_dump(mode="json")

    def schemes_tool(args: dict[str, Any]) -> dict[str, Any]:
        used.add("schemes")
        occupation = args.get("occupation")
        state = args.get("state")
        return scheme_service.find_schemes(
            occupation if occupation in OCCUPATIONS else "other_unorganised",
            state if state in STATES else "your state",
        )

    reply = await ai.chat(
        message=payload.message,
        history=payload.history,
        language=payload.language,
        tools={"get_earnings_summary": earnings_tool, "find_verified_schemes": schemes_tool},
    )
    return ChatResponse(
        reply=reply,
        used_earnings_data="earnings" in used,
        used_scheme_data="schemes" in used,
    )


@router.post("/summary/explain", response_model=ExplainResponse)
async def explain_summary(
    payload: LanguageRequest,
    db: sqlite3.Connection = Depends(get_db),
    device_id: str = Depends(get_device_id),
    today: date = Depends(get_today),
    ai: AIService = Depends(get_ai_service),
) -> ExplainResponse:
    """The numbers come from the database; the model only words them."""
    summary = earnings_repo.get_summary(db, device_id, today)
    text = await ai.explain_weekly_summary(
        summary_json=json.dumps(summary.model_dump(mode="json")), language=payload.language
    )
    return ExplainResponse(text=text)
