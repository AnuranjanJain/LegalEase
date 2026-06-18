from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from typing import List, Dict, Any

from backend.services.legal_mapping import map_problem_to_sections
from backend.services.ai_service import ai_service
from backend.services.langgraph_service import run_agent

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


class ClauseAnalysisRequest(BaseModel):
    text: str


class ClauseAnalysisItem(BaseModel):
    clause: str
    riskLevel: str
    riskReason: str


class ClauseAnalysisResponse(BaseModel):
    clauses: List[ClauseAnalysisItem]


class AgentRequest(BaseModel):
    query: str
    documents: List[str] = []


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
async def analyze_clauses(request: ClauseAnalysisRequest):
    try:
        clauses = await ai_service.analyze_clauses(request.text)
        return {"clauses": clauses}
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
