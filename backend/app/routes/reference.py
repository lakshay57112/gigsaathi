"""Safety guidance, welfare schemes and app metadata."""

import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from ..config import Settings, get_settings
from ..deps import get_ai_service, rate_limit_ai
from ..languages import LANGUAGES, OCCUPATIONS, STATES
from ..schemas import (
    MAX_AMOUNT,
    MAX_DOCUMENT_CHARS,
    AIInfo,
    ExplainResponse,
    LanguageOut,
    LanguageRequest,
    MetaOut,
)
from ..services import scheme_service
from ..services.ai_service import PROVIDER_NAME, AIService

router = APIRouter(prefix="/api", tags=["reference"])


class SchemeExplainRequest(LanguageRequest):
    occupation: str
    state: str


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/meta", response_model=MetaOut)
def meta(settings: Settings = Depends(get_settings)) -> MetaOut:
    return MetaOut(
        app_name=settings.app_name,
        ai=AIInfo(
            configured=bool(settings.gemini_api_key.strip()),
            provider=PROVIDER_NAME,
            model=settings.gemini_model,
        ),
        languages=[
            LanguageOut(code=code, name=lang.name, native=lang.native, speech_locale=lang.speech_locale)
            for code, lang in LANGUAGES.items()
        ],
        occupations=OCCUPATIONS,
        states=STATES,
        max_document_chars=MAX_DOCUMENT_CHARS,
        max_amount=MAX_AMOUNT,
    )


@router.get("/safety")
def safety() -> dict[str, Any]:
    return scheme_service.load_safety()


@router.post("/safety/explain", response_model=ExplainResponse, dependencies=[Depends(rate_limit_ai)])
async def explain_safety(
    payload: LanguageRequest, ai: AIService = Depends(get_ai_service)
) -> ExplainResponse:
    content = json.dumps(scheme_service.load_safety(), ensure_ascii=False)
    return ExplainResponse(text=await ai.explain_reference(content=content, language=payload.language))


def _validated_lookup(occupation: str, state: str) -> dict[str, Any]:
    if occupation not in OCCUPATIONS:
        raise HTTPException(status_code=422, detail="Unknown occupation.")
    if state not in STATES:
        raise HTTPException(status_code=422, detail="Unknown state.")
    return scheme_service.find_schemes(occupation, state)


@router.get("/schemes")
def schemes(occupation: str = Query(max_length=40), state: str = Query(max_length=60)) -> dict[str, Any]:
    """Plain lookup in the verified reference file. No AI call, so it is fast and free."""
    return _validated_lookup(occupation, state)


@router.post("/schemes/explain", response_model=ExplainResponse, dependencies=[Depends(rate_limit_ai)])
async def explain_schemes(
    payload: SchemeExplainRequest, ai: AIService = Depends(get_ai_service)
) -> ExplainResponse:
    content = json.dumps(_validated_lookup(payload.occupation, payload.state), ensure_ascii=False)
    return ExplainResponse(text=await ai.explain_reference(content=content, language=payload.language))
