import json
import os
import logging
from typing import List, Dict, Any, Optional

from backend.services.ai_service import ai_service

logger = logging.getLogger(__name__)


def _load_ipc_data() -> List[Dict[str, Any]]:
    base = os.path.dirname(os.path.dirname(__file__))
    data_path = os.path.join(base, "data", "ipc_bns.json")
    try:
        with open(data_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.warning("Could not load IPC/BNS data: %s", e)
        return []


_IPC_DATA = _load_ipc_data()


def _keyword_match(description: str) -> List[Dict[str, Any]]:
    desc = description.lower()
    matches: List[Dict[str, Any]] = []
    for entry in _IPC_DATA:
        kws = [k.lower() for k in entry.get("keywords", [])]
        matched = [k for k in kws if k in desc]
        if matched:
            out = {
                "section": entry.get("section"),
                "title": entry.get("title"),
                "summary": entry.get("summary"),
                "severity": entry.get("severity", "unknown"),
                "matched_keywords": matched,
                "confidence": 0.9,
            }
            matches.append(out)
    return matches


async def map_problem_to_sections(description: str, max_results: int = 5) -> List[Dict[str, Any]]:
    """Map a free-text problem description to likely IPC/BNS sections.

    Strategy:
    1. Try simple keyword matching from local dataset.
    2. If no matches, fall back to calling `ai_service` for suggested sections.
    """
    if not description or not description.strip():
        return []

    matches = _keyword_match(description)
    if matches:
        return matches[:max_results]

    # Fallback: ask AI service to suggest likely sections
    prompt = (
        "You are a legal assistant. Given a user's problem description, "
        "suggest up to 3 likely IPC/BNS sections in JSON array format. "
        "Each item must include: section, title (short), summary (one sentence), severity. "
        f"Problem: {description}"
    )

    try:
        response_gen = ai_service.generate_chat_response(message=prompt, stream=False)
        response_text = ""
        async for chunk in response_gen:
            response_text += chunk

        # Try parse JSON from AI response
        try:
            parsed = json.loads(response_text)
            if isinstance(parsed, list):
                return parsed[:max_results]
        except Exception:
            # Not JSON — return a single fallback suggestion
            return [
                {
                    "section": "UNKNOWN",
                    "title": "Suggested (AI)",
                    "summary": response_text.strip(),
                    "severity": "unknown",
                    "matched_keywords": [],
                    "confidence": 0.5,
                }
            ]
    except Exception as e:
        logger.exception("AI fallback failed: %s", e)

    return []
