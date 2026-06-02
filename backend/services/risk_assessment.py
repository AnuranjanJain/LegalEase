"""
Risk Assessment Service — Clause-level risk highlighting for legal documents.

Uses a hybrid approach:
1. Rule-based keyword/pattern matching for common risk indicators
2. Structural analysis for clause identification
3. AI fallback for nuanced risk classification

Risk levels:
  - HIGH (🔴): Unfavorable obligations, hidden liabilities, penalty clauses
  - MEDIUM (🟡): Restrictive terms, data privacy concerns, ambiguous language
  - LOW (🟢): Standard boilerplate, neutral terms
"""

import re
import logging
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, asdict

logger = logging.getLogger(__name__)


@dataclass
class RiskClause:
    """A single clause with its risk assessment."""
    clause_id: int
    text: str
    risk_level: str  # "high", "medium", "low"
    risk_score: float  # 0.0 - 1.0
    category: str  # e.g., "liability", "termination", "data_privacy"
    explanation: str
    matched_patterns: List[str]
    start_offset: int
    end_offset: int


@dataclass
class RiskAssessmentResult:
    """Complete risk assessment for a document."""
    total_clauses: int
    high_risk_count: int
    medium_risk_count: int
    low_risk_count: int
    overall_risk_score: float
    clauses: List[Dict[str, Any]]
    categories_found: List[str]


# ── Risk Pattern Definitions ──────────────────────────────────────────────────

HIGH_RISK_PATTERNS = [
    # Liability & Indemnification
    (r"indemnif\w*\s+(and|or)\s+hold\s+harmless", "liability", "Broad indemnification clause requiring you to cover third-party claims"),
    (r"unlimited\s+liability", "liability", "No cap on financial liability exposure"),
    (r"not\s+liable\s+for\s+any\s+(indirect|consequential|incidental|special|punitive)", "liability", "Other party disclaims all indirect damages — you bear full risk"),
    (r"sole\s+and\s+exclusive\s+remedy", "liability", "Limits your recovery options to a single remedy"),
    (r"liquidated\s+damages", "penalty", "Pre-determined penalty amount, may be disproportionate"),
    (r"penalt\w*\s+of\s+\$[\d,]+", "penalty", "Specific financial penalty for breach"),
    
    # Termination & Renewal
    (r"auto(?:matic)?[\s-]*renew\w*", "termination", "Automatic renewal — may lock you into extended commitment"),
    (r"terminat\w*\s+at\s+(its?\s+)?sole\s+discretion", "termination", "Other party can terminate at will, you cannot"),
    (r"non[\s-]*compete", "restrictive", "Non-compete restriction on future business activities"),
    (r"non[\s-]*solicit", "restrictive", "Non-solicitation restriction on hiring or client contact"),
    (r"perpetual\s+license", "ip_rights", "Perpetual license grant — irrevocable intellectual property rights"),
    (r"irrevocable", "ip_rights", "Irrevocable commitment — cannot be withdrawn or cancelled"),
    
    # Financial Risk
    (r"no\s+refund", "financial", "No refund policy — payment is non-recoverable"),
    (r"non[\s-]*refundable", "financial", "Non-recoverable payment"),
    (r"late\s+fee\w*\s+of\s+\d+\s*%", "financial", "Late payment penalty as percentage"),
    (r"interest\s+(at|@)\s+\d+\s*%\s*per\s+(annum|year|month)", "financial", "Interest rate on overdue payments"),
    (r"personal\s+guarantee", "financial", "Personal financial guarantee — exposes personal assets"),
    (r"joint(?:ly)?\s+and\s+several", "financial", "Joint and several liability — each party liable for full amount"),
    
    # Data & Privacy
    (r"data\s+breach\s+notifi\w*\s+within\s+\d+\s+day", "data_privacy", "Data breach notification timeline — check if adequate"),
    (r"waive\w*\s+(all\s+)?rights?\s+to\s+(a\s+)?jury\s+trial", "legal_rights", "Waives right to jury trial in disputes"),
    (r"class\s+action\s+waiver", "legal_rights", "Waives right to participate in class action lawsuits"),
    (r"binding\s+arbitrat", "legal_rights", "Mandatory binding arbitration — limits court access"),
    (r"govern(?:ed|ing)\s+law\s+of", "legal_rights", "Specifies governing jurisdiction — may be unfavorable"),
]

MEDIUM_RISK_PATTERNS = [
    # Ambiguous Language
    (r"reasonable\s+(efforts?|endeavou?rs?)", "ambiguous", "\"Reasonable efforts\" is subjective and may be disputed"),
    (r"material\s+(breach|adverse|change)", "ambiguous", "\"Material\" is subjective — defines critical threshold"),
    (r"best\s+efforts?", "ambiguous", "\"Best efforts\" imposes higher obligation than \"reasonable efforts\""),
    (r"as\s+may\s+be\s+(necessary|appropriate|required)", "ambiguous", "Open-ended discretion clause"),
    (r"sole\s+discretion", "ambiguous", "Unilateral decision-making power without objective standard"),
    (r"from\s+time\s+to\s+time", "ambiguous", "Permits unilateral changes at unspecified intervals"),
    
    # Restrictive Terms
    (r"exclusiv\w*\s+(right|license|access)", "restrictive", "Exclusive arrangement — limits your flexibility"),
    (r"right\s+of\s+first\s+refusal", "restrictive", "Other party gets first option on future opportunities"),
    (r"most\s+favou?red\s+nation", "restrictive", "MFN clause — must offer same terms to this party"),
    (r"non[\s-]*disparage", "restrictive", "Restricts public criticism of other party"),
    (r"confidential\w*\s+for\s+(a\s+)?period\s+of\s+\d+", "confidentiality", "Time-bound confidentiality obligation"),
    
    # Data & IP
    (r"intellectual\s+property\s+(of|owned\s+by|belongs?\s+to)", "ip_rights", "IP ownership clause — verify what you're giving up"),
    (r"assign\w*\s+(all\s+)?rights", "ip_rights", "Assignment of rights — transfer of ownership"),
    (r"work[\s-]*for[\s-]*hire", "ip_rights", "Work-for-hire — employer owns all created work"),
    (r"data\s+(shar|collect|process|retain)", "data_privacy", "Data handling clause — review privacy implications"),
    (r"third[\s-]*party\s+(sharing|disclosure|access)", "data_privacy", "Third-party data sharing — check consent requirements"),
    
    # Modification & Amendment
    (r"(reserv|right)\s+to\s+(modify|amend|change)\s+(these\s+)?terms", "modification", "Terms can be changed unilaterally"),
    (r"without\s+(prior\s+)?notice", "modification", "Changes may occur without advance notification"),
    (r"continued\s+(use|access)\s+constitutes?\s+accept", "modification", "Deemed acceptance by continued use — opt-out is stop using"),
]


def _split_into_clauses(text: str) -> List[Dict[str, Any]]:
    """
    Split document text into individual clauses.
    Uses paragraph boundaries, numbered sections, and sentence grouping.
    """
    # Split on double newlines (paragraphs), numbered sections, or "Article/Section" headers
    raw_splits = re.split(r'\n\s*\n|\n(?=\d+[\.\)])\s+|\n(?=(?:Article|Section|Clause|Para)\s+\d+)', text)
    
    clauses = []
    offset = 0
    
    for raw in raw_splits:
        stripped = raw.strip()
        if not stripped or len(stripped) < 20:
            # Skip very short fragments
            offset += len(raw) + 2  # +2 for the \n\n separator
            continue
        
        # Find the actual position in the original text
        start = text.find(stripped, max(0, offset - 50))
        if start == -1:
            start = offset
        
        clauses.append({
            "text": stripped,
            "start_offset": start,
            "end_offset": start + len(stripped),
        })
        offset = start + len(stripped)
    
    # If no clauses found, treat the entire text as one clause
    if not clauses and text.strip():
        clauses.append({
            "text": text.strip(),
            "start_offset": 0,
            "end_offset": len(text.strip()),
        })
    
    return clauses


def _assess_clause_risk(clause_text: str, clause_id: int, start_offset: int, end_offset: int) -> RiskClause:
    """
    Assess risk level for a single clause using pattern matching.
    """
    text_lower = clause_text.lower()
    
    matched_high = []
    matched_medium = []
    high_categories = set()
    medium_categories = set()
    
    # Check high-risk patterns
    for pattern, category, explanation in HIGH_RISK_PATTERNS:
        if re.search(pattern, text_lower):
            matched_high.append(pattern)
            high_categories.add(category)
    
    # Check medium-risk patterns
    for pattern, category, explanation in MEDIUM_RISK_PATTERNS:
        if re.search(pattern, text_lower):
            matched_medium.append(pattern)
            medium_categories.add(category)
    
    # Calculate risk score
    high_score = len(matched_high) * 0.3
    medium_score = len(matched_medium) * 0.15
    raw_score = min(1.0, high_score + medium_score)
    
    # Determine risk level
    if matched_high:
        risk_level = "high"
        risk_score = max(0.7, raw_score)
        primary_category = high_categories.pop() if high_categories else "general"
        # Get explanation from matched pattern
        explanation = _get_explanation(matched_high[0], HIGH_RISK_PATTERNS)
    elif matched_medium:
        risk_level = "medium"
        risk_score = max(0.4, min(0.69, raw_score))
        primary_category = medium_categories.pop() if medium_categories else "general"
        explanation = _get_explanation(matched_medium[0], MEDIUM_RISK_PATTERNS)
    else:
        risk_level = "low"
        risk_score = 0.1
        primary_category = "standard"
        explanation = "Standard clause with no significant risk indicators detected"
    
    all_patterns = [f"high:{p}" for p in matched_high] + [f"medium:{p}" for p in matched_medium]
    
    return RiskClause(
        clause_id=clause_id,
        text=clause_text[:500] + ("..." if len(clause_text) > 500 else ""),
        risk_level=risk_level,
        risk_score=round(risk_score, 2),
        category=primary_category,
        explanation=explanation,
        matched_patterns=all_patterns,
        start_offset=start_offset,
        end_offset=end_offset,
    )


def _get_explanation(matched_pattern: str, pattern_list: List[tuple]) -> str:
    """Get the human-readable explanation for a matched pattern."""
    for pattern, category, explanation in pattern_list:
        if pattern == matched_pattern:
            return explanation
    return "Risk pattern detected"


async def assess_document_risk(text: str, max_clauses: int = 100) -> RiskAssessmentResult:
    """
    Perform clause-level risk assessment on a legal document.
    
    Args:
        text: Full document text
        max_clauses: Maximum number of clauses to analyze
    
    Returns:
        RiskAssessmentResult with per-clause risk levels and overall score
    """
    if not text or not text.strip():
        return RiskAssessmentResult(
            total_clauses=0,
            high_risk_count=0,
            medium_risk_count=0,
            low_risk_count=0,
            overall_risk_score=0.0,
            clauses=[],
            categories_found=[],
        )
    
    # Split into clauses
    raw_clauses = _split_into_clauses(text)
    
    # Limit clauses to prevent excessive processing
    raw_clauses = raw_clauses[:max_clauses]
    
    # Assess each clause
    assessed: List[RiskClause] = []
    all_categories = set()
    
    for idx, clause_data in enumerate(raw_clauses):
        risk = _assess_clause_risk(
            clause_data["text"],
            clause_id=idx + 1,
            start_offset=clause_data["start_offset"],
            end_offset=clause_data["end_offset"],
        )
        assessed.append(risk)
        all_categories.add(risk.category)
    
    # Count by risk level
    high_count = sum(1 for c in assessed if c.risk_level == "high")
    medium_count = sum(1 for c in assessed if c.risk_level == "medium")
    low_count = sum(1 for c in assessed if c.risk_level == "low")
    
    # Calculate overall risk score (weighted average)
    if assessed:
        total_weighted = sum(c.risk_score for c in assessed)
        overall_score = round(total_weighted / len(assessed), 2)
    else:
        overall_score = 0.0
    
    # Convert to dict for JSON serialization
    clause_dicts = [asdict(c) for c in assessed]
    
    logger.info(
        f"Risk assessment complete: {len(assessed)} clauses, "
        f"{high_count} high, {medium_count} medium, {low_count} low, "
        f"overall score: {overall_score}"
    )
    
    return RiskAssessmentResult(
        total_clauses=len(assessed),
        high_risk_count=high_count,
        medium_risk_count=medium_count,
        low_risk_count=low_count,
        overall_risk_score=overall_score,
        clauses=clause_dicts,
        categories_found=sorted(all_categories),
    )
