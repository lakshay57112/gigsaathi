"""Document help and grievance drafting. Neither stores the text it receives."""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException

from ..deps import get_ai_service, get_today, rate_limit_ai
from ..schemas import (
    DocumentExplanation,
    DocumentRequest,
    GrievanceRequest,
    GrievanceResponse,
)
from ..services.ai_service import AIService

router = APIRouter(prefix="/api", tags=["documents"], dependencies=[Depends(rate_limit_ai)])


@router.post("/documents/explain", response_model=DocumentExplanation)
async def explain_document(
    payload: DocumentRequest, ai: AIService = Depends(get_ai_service)
) -> DocumentExplanation:
    # The pasted text is sent to the AI provider and returned; it is never saved or logged.
    return await ai.explain_document(text=payload.text, language=payload.language)


def _missing_details(request: GrievanceRequest) -> list[str]:
    missing = []
    if request.incident_date is None:
        missing.append("date of incident")
    if request.amount is None and request.issue_type in {
        "unpaid_payment",
        "incentive_not_paid",
        "unfair_deduction",
    }:
        missing.append("amount involved")
    return missing


@router.post("/grievance/draft", response_model=GrievanceResponse)
async def draft_grievance(
    payload: GrievanceRequest,
    ai: AIService = Depends(get_ai_service),
    today: date = Depends(get_today),
) -> GrievanceResponse:
    if payload.incident_date and payload.incident_date > today:
        raise HTTPException(status_code=422, detail="The incident date cannot be in the future.")
    draft = await ai.draft_grievance(payload)
    return GrievanceResponse(subject=draft.subject, body=draft.body, missing_details=_missing_details(payload))
