import logging
from io import BytesIO
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from backend.auth import validate_token_or_api_key, AuthIdentity
from backend.core.exceptions import ValidationError
from backend.core.validation import validate_export_pdf_input, sanitize_text
from backend.services.pdf_service import generate_pdf

logger = logging.getLogger(__name__)

# Register both direct and /api prefixed routes to function seamlessly on both local dev and production mounts.
router = APIRouter(tags=["export"])

class ChatMessagePayload(BaseModel):
    role: str
    content: str

class ExportPDFRequest(BaseModel):
    title: str = Field(..., max_length=200)
    summary: Optional[str] = None
    chatHistory: Optional[List[ChatMessagePayload]] = None


@router.post("/api/export/pdf")
@router.post("/export/pdf")
async def export_pdf(
    payload: ExportPDFRequest,
    identity: AuthIdentity = Depends(validate_token_or_api_key)
):
    """
    Secure endpoint to export document summaries and chat transcripts as a formatted PDF.
    Validates payloads and returns an application/pdf attachment stream.
    """
    try:
        # 1. Sanitize text inputs to prevent XML parsing and injection issues
        sanitized_title = sanitize_text(payload.title)
        sanitized_summary = sanitize_text(payload.summary) if payload.summary else None
        
        sanitized_chat_history = []
        if payload.chatHistory:
            for item in payload.chatHistory:
                sanitized_chat_history.append({
                    "role": sanitize_text(item.role),
                    "content": sanitize_text(item.content)
                })
                
        # 2. Invoke input validation
        validate_export_pdf_input(sanitized_title, sanitized_summary, sanitized_chat_history)
        
        # 3. Generate PDF byte stream
        pdf_bytes = generate_pdf(sanitized_title, sanitized_summary, sanitized_chat_history)
        
        # 4. Stream response to client
        return StreamingResponse(
            BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={
                "Content-Disposition": "attachment; filename=export.pdf"
            }
        )
    except ValidationError as e:
        raise e
    except Exception as e:
        logger.error(f"PDF generation failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while generating the PDF document."
        )
