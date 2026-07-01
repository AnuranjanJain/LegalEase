import json
from datetime import datetime

from fastapi import APIRouter,Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from backend.auth import validate_token_or_api_key, AuthIdentity
from backend.database import get_db
from backend import models
from backend.services.legal_mapping import map_problem_to_sections
from backend.services.ai_service import ai_service
from backend.services.entity_extraction import extract_entities
from backend.services.search_service import perform_web_search
from backend.services.langgraph_service import run_agent
from backend.services.hybrid_search import get_hybrid_results
from backend.utils.limiter import SimpleRateLimiter
from backend.config import get_settings

router = APIRouter(prefix="/legal", tags=["legal"])

# Reuses the same per-identity rate limiting pattern already established for
# /chat, /simplify, and /compare, scoped to this router's AI endpoints.
_settings = get_settings()
_redline_limiter = SimpleRateLimiter(
    calls=_settings.rate_limit.rate_limit_key_calls,
    period=_settings.rate_limit.rate_limit_period,
)


class ProblemRequest(BaseModel):
    description: str = Field(..., min_length=3)


class SectionSuggestion(BaseModel):
    section: str
    title: str
    summary: str
    severity: str
    matched_keywords: List[str] = []
    confidence: float = 0.0


class MappingResponse(BaseModel):
    suggestions: List[SectionSuggestion]


class ClauseAnalysisRequest(BaseModel):
    text: str
    document_id: Optional[int] = None

class ClauseAnalysisItem(BaseModel):
    clause: str
    riskLevel: str
    riskReason: str
    liability_score: Optional[int] = None


class ClauseAnalysisResponse(BaseModel):
    clauses: List[ClauseAnalysisItem]


class AgentRequest(BaseModel):
    query: str
    documents: List[str] = []

class HybridSearchRequest(BaseModel):
    query: str
    documents: List[str]
    top_k: int = 3


@router.post("/map", response_model=MappingResponse)
async def map_problem(request: ProblemRequest):
    try:
        suggestions = await map_problem_to_sections(request.description)
        return {"suggestions": suggestions}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.post("/analyze-clauses", response_model=ClauseAnalysisResponse)
async def analyze_clauses(
    request: ClauseAnalysisRequest,
    current_user:AuthIdentity = Depends(validate_token_or_api_key),
    db: Session = Depends(get_db),
):
    try:
        user_id = current_user.get_user_id()

        # If a document_id is supplied, check for a cached result first
        if request.document_id and user_id:
            doc = (
                db.query(models.DocumentRecord)
                .filter(
                    models.DocumentRecord.id == request.document_id,
                    models.DocumentRecord.user_id == user_id,
                )
                .first()
            )
            if doc and doc.clause_analysis:
                # Return cached result without calling AI
                return {"clauses": json.loads(doc.clause_analysis)}

        # Run AI inference
        clauses = await ai_service.analyze_clauses(request.text)
        if request.document_id and user_id:
            doc = (
                db.query(models.DocumentRecord)
                .filter(
                    models.DocumentRecord.id == request.document_id,
                    models.DocumentRecord.user_id == user_id,
                )
                .first()
            )
            if doc:
                doc.clause_analysis = json.dumps(
                    [c if isinstance(c, dict) else c.dict() for c in clauses]
                )
                doc.analyzed_at = datetime.utcnow()
                db.commit()

        return {"clauses": clauses}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )
    
@router.get("/documents/{document_id}/clauses", response_model=ClauseAnalysisResponse)
def get_cached_clauses(
    document_id: int,
    current_user: AuthIdentity = Depends(validate_token_or_api_key),
    db: Session = Depends(get_db),
):
    """
    Return previously cached clause analysis for a document.
    Returns 404 if the document doesn't exist or hasn't been analysed yet.
    """
    user_id = current_user.get_user_id()
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    doc = (
        db.query(models.DocumentRecord)
        .filter(
            models.DocumentRecord.id == document_id,
            models.DocumentRecord.user_id == user_id,
        )
        .first()
    )
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    if not doc.clause_analysis:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No clause analysis found for this document. Run /analyze-clauses with document_id first.",
        )

    return {"clauses": json.loads(doc.clause_analysis)}   


class EntityExtractionRequest(BaseModel):
    text: str



@router.post("/extract-entities")
async def extract_document_entities(request: EntityExtractionRequest):
    try:
        graph_data = extract_entities(request.text)
        return graph_data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )

class WebSearchRequest(BaseModel):
    query: str
    max_results: int = 5


@router.post("/web-search")
async def dynamic_web_search(request: WebSearchRequest):
    try:
        results = perform_web_search(request.query, request.max_results)
        return {"results": results}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )

@router.post("/agent")
async def run_legal_agent(request: AgentRequest):
    try:
        response = await run_agent(request.query, request.documents)
        return {"response": response}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )

@router.post("/hybrid-search")
async def perform_hybrid_search(request: HybridSearchRequest):
    try:
        results = get_hybrid_results(request.query, request.documents, request.top_k)
        return {"results": results}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


class RedlineSuggestionRequest(BaseModel):
    clause: str = Field(..., min_length=1, max_length=20_000)
    risk_reason: str = Field(default="", max_length=2_000)
    jurisdiction: str = "General / Not Specified"


class RedlineSuggestionResponse(BaseModel):
    original_text: str
    suggested_text: str


@router.post("/suggest-redline", response_model=RedlineSuggestionResponse)
async def suggest_redline(
    request: RedlineSuggestionRequest,
    identity: AuthIdentity = Depends(validate_token_or_api_key),
):
    """
    Suggest an alternative, less risky phrasing for a single contract clause,
    typically one already flagged by /analyze-clauses. The response is shaped
    to be passed directly to /export/redline-docx.
    """
    if not _redline_limiter.check(identity.get_rate_limit_key())["allowed"]:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Rate limit exceeded")

    try:
        suggested_text = await ai_service.suggest_redline(
            clause_text=request.clause,
            risk_reason=request.risk_reason,
            jurisdiction=request.jurisdiction,
        )
        return RedlineSuggestionResponse(original_text=request.clause, suggested_text=suggested_text)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The AI redline suggestion service encountered an error. Please try again.",
        )
