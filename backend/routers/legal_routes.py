from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from typing import List, Dict, Any

from backend.services.legal_mapping import map_problem_to_sections

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
