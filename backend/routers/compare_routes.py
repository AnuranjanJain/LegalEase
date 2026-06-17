"""
compare_routes.py
─────────────────
FastAPI router that handles multi-document comparison chat requests.

Endpoint: POST /compare/chat

The frontend sends the user's question together with an array of document
objects (id, name, text).  This router validates the payload, delegates
prompt construction and LLM invocation to ComparisonService, and returns
a structured Markdown response.

Security notes:
  - Auth is enforced via the shared `validate_token_or_api_key` dependency,
    identical to every other protected endpoint in the app.
  - Document text is supplied by the authenticated client, NOT fetched from a
    database using caller-supplied IDs, so there is no cross-user data access
    risk at the retrieval layer.  If a server-side document store is added in
    the future, ownership must be verified before text is loaded.
  - Input is sanitised through the same `sanitize_text` helper used by /chat.
"""

from __future__ import annotations

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field, field_validator

from backend.auth import validate_token_or_api_key, AuthIdentity
from backend.core.validation import sanitize_text, validate_jurisdiction
from backend.services.comparison_service import comparison_service, MAX_DOCUMENTS
from backend.services.ai_service import correlation_id_var
from backend.utils.limiter import SimpleRateLimiter
import os

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/compare", tags=["compare"])

# Separate rate-limiter for comparison requests (they're heavier than plain chat)
_COMPARE_RATE_CALLS = int(os.getenv("COMPARE_RATE_LIMIT_CALLS", "60"))
_COMPARE_RATE_PERIOD = int(os.getenv("COMPARE_RATE_LIMIT_PERIOD", "60"))
_compare_limiter = SimpleRateLimiter(calls=_COMPARE_RATE_CALLS, period=_COMPARE_RATE_PERIOD)


# ---------------------------------------------------------------------------
# Request / response schemas
# ---------------------------------------------------------------------------

class DocumentPayload(BaseModel):
    """A single document's metadata and text content."""
    id: str = Field(..., min_length=1, max_length=256)
    name: str = Field(..., min_length=1, max_length=512)
    text: str = Field(default="", max_length=50_000)

    @field_validator("name")
    @classmethod
    def name_must_not_be_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Document name must not be blank.")
        return v.strip()

    @field_validator("id")
    @classmethod
    def id_must_not_be_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Document id must not be blank.")
        return v.strip()


class CompareRequest(BaseModel):
    """
    Payload for POST /compare/chat.

    Fields
    ------
    message:
        The user's comparison question (e.g. "Compare termination clauses").
    document_texts:
        Array of document objects containing id, name, and extracted text.
        Must contain at least 2 entries; maximum is capped by MAX_DOCUMENTS.
    document_ids:
        Optional list of IDs mirroring document_texts.  Accepted for
        backward compatibility / API clarity but not used server-side
        (text is taken from document_texts).
    conversation_history:
        Optional list of previous turns for follow-up questions.
    """
    message: str = Field(..., min_length=1, max_length=4000)
    document_texts: List[DocumentPayload] = Field(..., min_length=2)
    document_ids: Optional[List[str]] = None
    conversation_history: Optional[List[dict]] = None
    jurisdiction: str = "General / Not Specified"


    @field_validator("document_texts")
    @classmethod
    def validate_document_count(cls, v: List[DocumentPayload]) -> List[DocumentPayload]:
        if len(v) < 2:
            raise ValueError("At least 2 documents are required for comparison.")
        if len(v) > MAX_DOCUMENTS:
            raise ValueError(
                f"Cannot compare more than {MAX_DOCUMENTS} documents in a single request."
            )
        # Ensure IDs are unique — duplicate IDs would confuse the LLM context
        ids = [d.id for d in v]
        if len(ids) != len(set(ids)):
            raise ValueError("Document IDs must be unique within a comparison request.")
        return v


class CompareResponse(BaseModel):
    """Structured response from the comparison endpoint."""
    response: str


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.post(
    "/chat",
    response_model=CompareResponse,
    summary="Multi-document comparison chat",
    description=(
        "Accepts a user question and 2–10 legal documents, then returns a "
        "structured Markdown analysis comparing the documents across key "
        "legal dimensions (similarities, differences, conflicts, recommendations)."
    ),
)
async def compare_chat(
    request: Request,
    payload: CompareRequest,
    identity: AuthIdentity = Depends(validate_token_or_api_key),
) -> CompareResponse:
    corr_id = correlation_id_var.get()

    # Rate limiting
    if not _compare_limiter.check(identity.get_rate_limit_key())["allowed"]:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Comparison rate limit exceeded. Please wait before retrying.",
        )

    # Sanitise user message
    sanitized_message = sanitize_text(payload.message)
    if not sanitized_message.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message must not be empty after sanitisation.",
        )
    
    # Validate jurisdiction
    from backend.core.exceptions import ValidationError
    try:
        validate_jurisdiction(payload.jurisdiction)
    except ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    # Build the document list for the service layer, sanitising each text field
    documents = [
        {
            "id": doc.id,
            "name": doc.name,
            "text": sanitize_text(doc.text) if doc.text else "",
        }
        for doc in payload.document_texts
    ]

    # Log (without PII-sensitive text content)
    logger.info(
        "[%s] Comparison request — %d documents, message length %d",
        corr_id,
        len(documents),
        len(sanitized_message),
    )

    try:
        result = await comparison_service.compare_documents(
            message=sanitized_message,
            documents=documents,
            history=payload.conversation_history,
            jurisdiction=payload.jurisdiction,
        )
    except ValueError as exc:
        # Raised by comparison_service for invalid document count etc.
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        logger.error(
            "[%s] Comparison service error: %s", corr_id, exc, exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The AI comparison service encountered an error. Please try again.",
        )

    return CompareResponse(response=result)
