"""Generative AI integration (Google Gemini).

All provider-specific code lives in this one module. To use another provider, replace the
request/response handling in `_generate`, `_parts` and the tool declarations below.
"""

import asyncio
import hashlib
import json
import logging
import re
from collections.abc import Callable
from typing import Any, TypeVar

import httpx
from pydantic import BaseModel, ValidationError

from ..config import Settings
from ..schemas import ChatTurn, DocumentExplanation, GrievanceDraft, GrievanceRequest, PayoutExtraction
from . import prompts

log = logging.getLogger(__name__)

PROVIDER_NAME = "Google Gemini"
API_ROOT = "https://generativelanguage.googleapis.com/v1beta/models"
MAX_TOOL_ROUNDS = 3
CACHE_SIZE = 64
_BLOCK_REASONS = {"SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "RECITATION", "SPII"}

ToolHandler = Callable[[dict[str, Any]], dict[str, Any]]
ModelT = TypeVar("ModelT", bound=BaseModel)


class AIError(Exception):
    """Base class. `code` and `message` are safe to show to the user."""

    status_code = 503
    code = "ai_unavailable"
    message = "The AI assistant is not available right now. Please try again in a little while."

    def __init__(self, message: str | None = None) -> None:
        super().__init__(message or self.message)
        self.message = message or self.message


class AINotConfiguredError(AIError):
    code = "ai_not_configured"
    message = "The AI service is not set up on this server yet, so this feature is unavailable."


class AIBusyError(AIError):
    code = "ai_busy"
    message = "The AI service is very busy. Please wait a minute and try again."


class AIBlockedError(AIError):
    status_code = 422
    code = "ai_blocked"
    message = "The AI could not answer this request. Please try rewording it."


class AIBadResponseError(AIError):
    status_code = 502
    code = "ai_bad_response"
    message = "The AI gave an answer that could not be used. Please try again."


# Tool declarations in Gemini's function-calling format.
TOOL_DECLARATIONS = [
    {
        "name": "get_earnings_summary",
        "description": (
            "Returns the worker's REAL recorded earnings: today, the last 7 days and all-time "
            "totals (gross, expenses, net, hours) plus weekly insights. Call this for any "
            "question about income, expenses, hours or earnings."
        ),
    },
    {
        "name": "find_verified_schemes",
        "description": (
            "Returns verified welfare schemes, each with eligibility, documents, source and "
            "verification status. Call this for any question about welfare schemes or benefits."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "occupation": {
                    "type": "string",
                    "description": "One of: delivery_partner, driver, daily_wage, "
                    "domestic_worker, street_vendor, other_unorganised",
                },
                "state": {"type": "string", "description": "Indian state or union territory"},
            },
        },
    },
]


def _text_content(role: str, text: str) -> dict[str, Any]:
    return {"role": role, "parts": [{"text": text}]}


def _strip_code_fence(text: str) -> str:
    match = re.fullmatch(r"\s*```(?:json)?\s*(.*?)\s*```\s*", text, flags=re.DOTALL)
    return match.group(1) if match else text


class AIService:
    def __init__(
        self, settings: Settings, transport: httpx.AsyncBaseTransport | None = None
    ) -> None:
        self._settings = settings
        self._client = httpx.AsyncClient(timeout=settings.gemini_timeout_seconds, transport=transport)
        self._cache: dict[str, str] = {}

    @property
    def is_configured(self) -> bool:
        return bool(self._settings.gemini_api_key.strip())

    @property
    def model(self) -> str:
        return self._settings.gemini_model

    # ---- Public features --------------------------------------------------------------

    async def chat(
        self,
        *,
        message: str,
        history: list[ChatTurn],
        language: str,
        tools: dict[str, ToolHandler],
    ) -> str:
        """Answer a question. The model may call `tools` to read the worker's real data."""
        contents = [
            _text_content("user" if turn.role == "user" else "model", turn.text) for turn in history
        ]
        contents.append(_text_content("user", message))
        body = self._body(
            prompts.chat_system(language, self._settings.app_name),
            contents,
            temperature=0.4,
            tools=[{"functionDeclarations": TOOL_DECLARATIONS}],
        )

        for _ in range(MAX_TOOL_ROUNDS + 1):
            parts = self._parts(await self._generate(body))
            calls = [p["functionCall"] for p in parts if "functionCall" in p]
            if not calls:
                return self._text(parts)
            # Return the model's own parts unchanged, then answer each tool call.
            contents.append({"role": "model", "parts": parts})
            contents.append({"role": "user", "parts": [self._run_tool(c, tools) for c in calls]})
        raise AIBadResponseError()

    async def explain_document(self, *, text: str, language: str) -> DocumentExplanation:
        body = self._body(
            prompts.document_system(language),
            [_text_content("user", f"<document>\n{text}\n</document>")],
            temperature=0.2,
            json_mode=True,
        )
        return self._parse(await self._generate(body), DocumentExplanation)

    async def read_payout_slip(self, *, text: str, language: str) -> PayoutExtraction:
        body = self._body(
            prompts.payout_system(language),
            [_text_content("user", f"<document>\n{text}\n</document>")],
            temperature=0.1,
            json_mode=True,
        )
        return self._parse(await self._generate(body), PayoutExtraction)

    async def draft_grievance(self, request: GrievanceRequest) -> GrievanceDraft:
        body = self._body(
            prompts.grievance_system(request.language),
            [_text_content("user", prompts.grievance_user(request))],
            temperature=0.5,
            json_mode=True,
        )
        return self._parse(await self._generate(body), GrievanceDraft)

    async def explain_reference(self, *, content: str, language: str) -> str:
        """Re-explain verified reference text (safety tips, schemes) in simple language.

        Results are cached: the same text in the same language needs only one model call.
        """
        key = hashlib.sha256(f"{language}\n{content}".encode()).hexdigest()
        if key in self._cache:
            return self._cache[key]
        body = self._body(
            prompts.explain_reference_system(language),
            [_text_content("user", f"<reference>\n{content}\n</reference>")],
            temperature=0.2,
        )
        text = self._text(self._parts(await self._generate(body)))
        if len(self._cache) >= CACHE_SIZE:
            self._cache.pop(next(iter(self._cache)))
        self._cache[key] = text
        return text

    async def explain_weekly_summary(self, *, summary_json: str, language: str) -> str:
        body = self._body(
            prompts.weekly_summary_system(language),
            [_text_content("user", f"<data>\n{summary_json}\n</data>")],
            temperature=0.3,
        )
        return self._text(self._parts(await self._generate(body)))

    # ---- Gemini request and response handling ------------------------------------------

    @staticmethod
    def _body(
        system: str,
        contents: list[dict[str, Any]],
        *,
        temperature: float,
        json_mode: bool = False,
        tools: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        config: dict[str, Any] = {"temperature": temperature, "maxOutputTokens": 2048}
        if json_mode:
            config["responseMimeType"] = "application/json"
        body: dict[str, Any] = {
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": contents,
            "generationConfig": config,
        }
        if tools:
            body["tools"] = tools
        return body

    async def _generate(self, body: dict[str, Any]) -> dict[str, Any]:
        if not self.is_configured:
            raise AINotConfiguredError()
        url = f"{API_ROOT}/{self._settings.gemini_model}:generateContent"
        # The key goes in a header, never in the URL, so it cannot leak into logs.
        headers = {"x-goog-api-key": self._settings.gemini_api_key}

        for attempt in range(2):
            try:
                response = await self._client.post(url, json=body, headers=headers)
            except httpx.HTTPError as exc:
                log.warning("Gemini request failed: %s", type(exc).__name__)
                if attempt == 0:
                    await asyncio.sleep(self._settings.gemini_retry_delay_seconds)
                    continue
                raise AIError() from exc

            if response.status_code == 429:
                raise AIBusyError()
            if response.status_code >= 500:
                log.warning("Gemini server error: %s", response.status_code)
                if attempt == 0:
                    await asyncio.sleep(self._settings.gemini_retry_delay_seconds)
                    continue
                raise AIError()
            if response.status_code >= 400:
                # Almost always a bad key or model name. Log the status only, not the body.
                log.error("Gemini rejected the request: HTTP %s", response.status_code)
                raise AIError(
                    "The AI service rejected the request. The server's API key or model "
                    "setting may be wrong."
                )
            try:
                return response.json()
            except ValueError as exc:
                raise AIBadResponseError() from exc
        raise AIError()

    @staticmethod
    def _parts(data: dict[str, Any]) -> list[dict[str, Any]]:
        candidates = data.get("candidates") or []
        if not candidates:
            raise AIBlockedError()
        candidate = candidates[0]
        parts = (candidate.get("content") or {}).get("parts") or []
        if not parts:
            raise AIBlockedError() if candidate.get("finishReason") in _BLOCK_REASONS else AIBadResponseError()
        return parts

    @staticmethod
    def _text(parts: list[dict[str, Any]]) -> str:
        text = "".join(p["text"] for p in parts if "text" in p and not p.get("thought")).strip()
        if not text:
            raise AIBadResponseError()
        return text

    def _parse(self, data: dict[str, Any], model: type[ModelT]) -> ModelT:
        text = _strip_code_fence(self._text(self._parts(data)))
        try:
            return model.model_validate_json(text)
        except ValidationError as exc:
            log.warning("Model returned JSON that failed validation (%d errors)", exc.error_count())
            raise AIBadResponseError() from exc

    @staticmethod
    def _run_tool(call: dict[str, Any], tools: dict[str, ToolHandler]) -> dict[str, Any]:
        name = call.get("name", "")
        handler = tools.get(name)
        if handler is None:
            result: dict[str, Any] = {"error": f"Unknown tool {name}"}
        else:
            result = handler(call.get("args") or {})
        # Round-trip through JSON so dates and models become plain data.
        return {"functionResponse": {"name": name, "response": {"result": json.loads(json.dumps(result, default=str))}}}
