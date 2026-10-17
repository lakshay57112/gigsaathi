"""Verified welfare-scheme reference data.

Schemes come from data/schemes.json only; the AI may explain them but never adds to them.
"""

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

VERIFICATION_STATUSES = ("verified", "partially_verified", "unverified")


@lru_cache
def load_reference() -> dict[str, Any]:
    return json.loads((DATA_DIR / "schemes.json").read_text(encoding="utf-8"))


@lru_cache
def load_safety() -> dict[str, Any]:
    return json.loads((DATA_DIR / "safety.json").read_text(encoding="utf-8"))


def find_schemes(occupation: str, state: str) -> dict[str, Any]:
    """Return schemes matching an occupation and state, plus honest notes about gaps."""
    reference = load_reference()
    matches = [
        s
        for s in reference["schemes"]
        if ("all" in s["occupations"] or occupation in s["occupations"])
        and ("all" in s["states"] or state in s["states"])
    ]
    has_state_entry = any("all" not in s["states"] for s in matches)
    notes = list(reference["notes"])
    if not has_state_entry:
        notes.append(
            f"No state-specific information for {state} has been verified in this app. "
            f"Please ask the {state} labour department about state gig-worker or "
            "unorganised-worker welfare boards."
        )
    return {"occupation": occupation, "state": state, "schemes": matches, "notes": notes}
