import logging
import json
import asyncio
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


def _chunk_bytes(data: bytes, chunk_size: int = 8192):
    """Yield data in fixed-size chunks for streaming transfer."""
    for i in range(0, len(data), chunk_size):
        yield data[i:i + chunk_size]


def _count_pdf_pages(pdf_bytes: bytes) -> int:
    """Estimate page count from PDF bytes by counting page markers."""
    try:
        # Count occurrences of "/Type /Page" which marks each page object
        import re
        pages = re.findall(rb'/Type\s*/Page[^s]', pdf_bytes)
        return max(len(pages), 1)
    except Exception:
        return 1


@router.post("/api/export/pdf")
@router.post("/export/pdf")
async def export_pdf(
    payload: ExportPDFRequest,
    identity: AuthIdentity = Depends(validate_token_or_api_key)
):
    """
    Secure endpoint to export document summaries and chat transcripts as a formatted PDF.
    Validates payloads and returns an application/pdf attachment stream with metadata headers.
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
        page_count = _count_pdf_pages(pdf_bytes)
        
        # 4. Stream response to client with chunked transfer and metadata
        return StreamingResponse(
            _chunk_bytes(pdf_bytes),
            media_type="application/pdf",
            headers={
                "Content-Disposition": "attachment; filename=export.pdf",
                "Content-Length": str(len(pdf_bytes)),
                "X-PDF-Page-Count": str(page_count),
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


@router.post("/api/export/pdf/stream")
@router.post("/export/pdf/stream")
async def export_pdf_stream(
    payload: ExportPDFRequest,
    identity: AuthIdentity = Depends(validate_token_or_api_key)
):
    """
    SSE endpoint for streaming PDF generation progress updates.
    Emits progress events during PDF generation for large documents,
    followed by a completion event with the download URL.
    """
    async def event_generator():
        try:
            # Phase 1: Sanitization
            yield f"data: {json.dumps({'phase': 'sanitizing', 'progress': 10, 'message': 'Sanitizing inputs...'})}\n\n"
            await asyncio.sleep(0)  # yield control

            sanitized_title = sanitize_text(payload.title)
            sanitized_summary = sanitize_text(payload.summary) if payload.summary else None
            sanitized_chat_history = []
            if payload.chatHistory:
                for item in payload.chatHistory:
                    sanitized_chat_history.append({
                        "role": sanitize_text(item.role),
                        "content": sanitize_text(item.content)
                    })

            # Phase 2: Validation
            yield f"data: {json.dumps({'phase': 'validating', 'progress': 30, 'message': 'Validating content...'})}\n\n"
            await asyncio.sleep(0)
            validate_export_pdf_input(sanitized_title, sanitized_summary, sanitized_chat_history)

            # Phase 3: PDF Generation
            yield f"data: {json.dumps({'phase': 'generating', 'progress': 50, 'message': 'Generating PDF document...'})}\n\n"
            await asyncio.sleep(0)
            pdf_bytes = generate_pdf(sanitized_title, sanitized_summary, sanitized_chat_history)

            # Phase 4: Finalization
            page_count = _count_pdf_pages(pdf_bytes)
            yield f"data: {json.dumps({'phase': 'complete', 'progress': 100, 'message': 'PDF ready for download', 'pageCount': page_count, 'sizeBytes': len(pdf_bytes)})}\n\n"

        except ValidationError as e:
            yield f"data: {json.dumps({'phase': 'error', 'progress': 0, 'message': str(e)})}\n\n"
        except Exception as e:
            logger.error(f"Streaming PDF generation failed: {e}", exc_info=True)
            yield f"data: {json.dumps({'phase': 'error', 'progress': 0, 'message': 'An error occurred while generating the PDF document.'})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    )
