from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

from backend.services.legal_mapping import map_problem_to_sections
from backend.services.risk_assessment import assess_document_risk

router = APIRouter(prefix="/legal", tags=["legal"])


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


class RiskAssessRequest(BaseModel):
    text: str = Field(..., min_length=10, description="Document text to assess for risks")
    max_clauses: int = Field(default=100, ge=1, le=500, description="Maximum clauses to analyze")


class ClauseRisk(BaseModel):
    clause_id: int
    text: str
    risk_level: str
    risk_score: float
    category: str
    explanation: str
    matched_patterns: List[str] = []
    start_offset: int
    end_offset: int


class RiskAssessResponse(BaseModel):
    total_clauses: int
    high_risk_count: int
    medium_risk_count: int
    low_risk_count: int
    overall_risk_score: float
    clauses: List[ClauseRisk]
    categories_found: List[str]


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


@router.post("/risk-assess", response_model=RiskAssessResponse)
async def risk_assess(request: RiskAssessRequest):
    """
    Perform clause-level risk assessment on a legal document.

    Analyzes each clause for risk indicators including:
    - Unfavorable liability/indemnification terms
    - Restrictive covenants (non-compete, non-solicitation)
    - Financial penalties and unfavorable payment terms
    - Data privacy and IP concerns
    - Ambiguous language that may be exploited
    - Termination and renewal traps

    Returns per-clause risk levels (high/medium/low) with explanations.
    """
    try:
        result = await assess_document_risk(request.text, request.max_clauses)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Risk assessment failed: {str(e)}",
        )
