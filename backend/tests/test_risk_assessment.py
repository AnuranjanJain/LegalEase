"""
Unit tests for risk_assessment.py — clause-level risk highlighting.

Tests cover:
- Clause splitting logic
- Risk pattern matching (high, medium, low)
- Edge cases (empty text, very long text, non-legal text)
- Category detection
- Risk score calculation
- Full document assessment pipeline
"""

import pytest
import sys
from pathlib import Path

# Ensure backend is importable
ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.services.risk_assessment import (
    _split_into_clauses,
    _assess_clause_risk,
    assess_document_risk,
    RiskClause,
    RiskAssessmentResult,
    HIGH_RISK_PATTERNS,
    MEDIUM_RISK_PATTERNS,
)


# ── Clause Splitting ─────────────────────────────────────────────────────────

class TestClauseSplitting:
    """Tests for _split_into_clauses."""

    def test_splits_on_double_newlines(self):
        text = "First clause paragraph.\n\nSecond clause paragraph.\n\nThird clause paragraph."
        clauses = _split_into_clauses(text)
        assert len(clauses) == 3

    def test_single_paragraph_single_clause(self):
        text = "This is a single paragraph with enough text to be considered a clause."
        clauses = _split_into_clauses(text)
        assert len(clauses) == 1
        assert clauses[0]["text"] == text

    def test_skips_very_short_fragments(self):
        text = "Short\n\nThis is a longer paragraph that should be kept as a clause because it has enough text."
        clauses = _split_into_clauses(text)
        # "Short" (5 chars) should be skipped (< 20 chars)
        assert all(len(c["text"]) >= 20 for c in clauses)

    def test_empty_text_returns_empty(self):
        clauses = _split_into_clauses("")
        assert clauses == []

    def test_whitespace_only_returns_empty(self):
        clauses = _split_into_clauses("   \n\n   ")
        assert clauses == []

    def test_preserves_offsets(self):
        text = "First paragraph here.\n\nSecond paragraph here."
        clauses = _split_into_clauses(text)
        for clause in clauses:
            assert text[clause["start_offset"]:clause["end_offset"]] == clause["text"]

    def test_numbered_sections(self):
        text = "1. First section with enough content to be a clause.\n2. Second section with enough content to be a clause."
        clauses = _split_into_clauses(text)
        assert len(clauses) >= 1

    def test_article_headers(self):
        text = "Article 1: Terms and conditions apply to all parties.\n\nArticle 2: Liability is limited to the contract amount."
        clauses = _split_into_clauses(text)
        assert len(clauses) == 2


# ── Risk Pattern Matching ────────────────────────────────────────────────────

class TestHighRiskPatterns:
    """Tests for high-risk pattern detection."""

    def test_indemnification_detected(self):
        text = "The Vendor shall indemnify and hold harmless the Client against all claims."
        result = _assess_clause_risk(text, 1, 0, len(text))
        assert result.risk_level == "high"
        assert result.category == "liability"
        assert any("indemnif" in p for p in result.matched_patterns)

    def test_unlimited_liability_detected(self):
        text = "In no event shall there be unlimited liability for either party."
        result = _assess_clause_risk(text, 1, 0, len(text))
        assert result.risk_level == "high"

    def test_no_refund_detected(self):
        text = "All payments are final with no refund available for any reason."
        result = _assess_clause_risk(text, 1, 0, len(text))
        assert result.risk_level == "high"
        assert result.category == "financial"

    def test_auto_renewal_detected(self):
        text = "This agreement shall automatic renew for successive one-year terms."
        result = _assess_clause_risk(text, 1, 0, len(text))
        assert result.risk_level == "high"
        assert result.category == "termination"

    def test_jury_trial_waiver_detected(self):
        text = "Both parties hereby waive all rights to a jury trial in any dispute."
        result = _assess_clause_risk(text, 1, 0, len(text))
        assert result.risk_level == "high"
        assert result.category == "legal_rights"

    def test_binding_arbitration_detected(self):
        text = "All disputes shall be resolved through binding arbitration."
        result = _assess_clause_risk(text, 1, 0, len(text))
        assert result.risk_level == "high"
        assert result.category == "legal_rights"

    def test_non_compete_detected(self):
        text = "Employee agrees to a non-compete restriction for 2 years after termination."
        result = _assess_clause_risk(text, 1, 0, len(text))
        assert result.risk_level == "high"
        assert result.category == "restrictive"

    def test_personal_guarantee_detected(self):
        text = "The undersigned provides a personal guarantee for all obligations."
        result = _assess_clause_risk(text, 1, 0, len(text))
        assert result.risk_level == "high"
        assert result.category == "financial"

    def test_liquidated_damages_detected(self):
        text = "Breach shall result in liquidated damages of $50,000."
        result = _assess_clause_risk(text, 1, 0, len(text))
        assert result.risk_level == "high"
        assert result.category == "penalty"


class TestMediumRiskPatterns:
    """Tests for medium-risk pattern detection."""

    def test_reasonable_efforts_detected(self):
        text = "The provider shall use reasonable efforts to maintain service availability."
        result = _assess_clause_risk(text, 1, 0, len(text))
        assert result.risk_level == "medium"
        assert result.category == "ambiguous"

    def test_sole_discretion_detected(self):
        text = "The company may at its sole discretion modify the terms of service."
        result = _assess_clause_risk(text, 1, 0, len(text))
        assert result.risk_level == "medium"

    def test_exclusive_rights_detected(self):
        text = "The licensee receives exclusive rights to distribute the product."
        result = _assess_clause_risk(text, 1, 0, len(text))
        assert result.risk_level == "medium"
        assert result.category == "restrictive"

    def test_ip_assignment_detected(self):
        text = "Contractor agrees to assign all rights in work product to the company."
        result = _assess_clause_risk(text, 1, 0, len(text))
        assert result.risk_level == "medium"
        assert result.category == "ip_rights"

    def test_unilateral_modification_detected(self):
        text = "We reserve the right to modify these terms at any time."
        result = _assess_clause_risk(text, 1, 0, len(text))
        assert result.risk_level == "medium"
        assert result.category == "modification"

    def test_third_party_sharing_detected(self):
        text = "Your data may be subject to third party sharing with our partners."
        result = _assess_clause_risk(text, 1, 0, len(text))
        assert result.risk_level == "medium"
        assert result.category == "data_privacy"


class TestLowRiskClauses:
    """Tests for low-risk (standard) clauses."""

    def test_standard_boilerplate_is_low(self):
        text = "This agreement is governed by the laws of the State of Delaware."
        result = _assess_clause_risk(text, 1, 0, len(text))
        # May match governing law pattern (medium), but should not be high
        assert result.risk_level in ("low", "medium")

    def test_plain_text_is_low(self):
        text = "The meeting will be held on Tuesday at 3pm in the conference room."
        result = _assess_clause_risk(text, 1, 0, len(text))
        assert result.risk_level == "low"
        assert result.risk_score <= 0.3

    def test_neutral_clause_is_low(self):
        text = "Both parties agree to cooperate in good faith during the term."
        result = _assess_clause_risk(text, 1, 0, len(text))
        assert result.risk_level == "low"


# ── Risk Score Calculation ────────────────────────────────────────────────────

class TestRiskScoreCalculation:
    """Tests for risk score computation."""

    def test_high_risk_minimum_score(self):
        text = "The vendor shall indemnify and hold harmless the client."
        result = _assess_clause_risk(text, 1, 0, len(text))
        assert result.risk_score >= 0.7

    def test_medium_risk_score_range(self):
        text = "The provider shall use reasonable efforts to maintain availability."
        result = _assess_clause_risk(text, 1, 0, len(text))
        assert 0.4 <= result.risk_score <= 0.69

    def test_low_risk_score(self):
        text = "The meeting will be held on Tuesday at the main office."
        result = _assess_clause_risk(text, 1, 0, len(text))
        assert result.risk_score <= 0.3

    def test_multiple_high_patterns_increase_score(self):
        text = "The vendor shall indemnify and hold harmless with unlimited liability and no refund."
        result = _assess_clause_risk(text, 1, 0, len(text))
        assert result.risk_level == "high"
        assert result.risk_score >= 0.7


# ── Full Document Assessment ─────────────────────────────────────────────────

class TestDocumentAssessment:
    """Tests for the full assess_document_risk pipeline."""

    @pytest.mark.asyncio
    async def test_empty_document(self):
        result = await assess_document_risk("")
        assert result.total_clauses == 0
        assert result.overall_risk_score == 0.0

    @pytest.mark.asyncio
    async def test_basic_document(self):
        text = """
        This agreement shall indemnify and hold harmless the Company.

        The provider shall use reasonable efforts to maintain uptime.

        The meeting will be held on Tuesday at 3pm.
        """
        result = await assess_document_risk(text)
        assert result.total_clauses >= 1
        assert result.high_risk_count >= 0
        assert isinstance(result.overall_risk_score, float)

    @pytest.mark.asyncio
    async def test_all_high_risk_document(self):
        text = """
        The vendor shall indemnify and hold harmless the Client.

        All payments are non-refundable with no refund available.

        This agreement includes automatic renewal without prior notice.
        """
        result = await assess_document_risk(text)
        assert result.high_risk_count >= 1
        assert result.overall_risk_score >= 0.3

    @pytest.mark.asyncio
    async def test_max_clauses_limit(self):
        # Generate many paragraphs
        paragraphs = [f"This is clause number {i} with enough text to be considered a valid clause." for i in range(200)]
        text = "\n\n".join(paragraphs)
        result = await assess_document_risk(text, max_clauses=10)
        assert result.total_clauses <= 10

    @pytest.mark.asyncio
    async def test_categories_detected(self):
        text = """
        The vendor shall indemnify and hold harmless the Client against all claims.
        All disputes shall be resolved through binding arbitration.
        """
        result = await assess_document_risk(text)
        assert len(result.categories_found) >= 1

    @pytest.mark.asyncio
    async def test_returns_clause_dicts(self):
        text = """
        The vendor shall indemnify and hold harmless the Client.
        The provider shall use reasonable efforts to maintain service.
        """
        result = await assess_document_risk(text)
        assert isinstance(result.clauses, list)
        for clause in result.clauses:
            assert "clause_id" in clause
            assert "text" in clause
            assert "risk_level" in clause
            assert "risk_score" in clause
            assert "category" in clause
            assert "explanation" in clause

    @pytest.mark.asyncio
    async def test_realistic_contract(self):
        """Test with a realistic contract excerpt."""
        text = """
        1. DEFINITIONS
        "Confidential Information" means any proprietary data, trade secrets, or business information.

        2. INDEMNIFICATION
        The Contractor shall indemnify and hold harmless the Company from any claims, damages, or expenses.

        3. LIMITATION OF LIABILITY
        In no event shall the Company be liable for any indirect, consequential, or incidental damages.

        4. TERM AND TERMINATION
        This Agreement shall automatic renew for successive one-year terms unless terminated.

        5. GOVERNING LAW
        This Agreement shall be governed by the laws of the State of California.

        6. PAYMENT TERMS
        All fees are non-refundable. Late payments shall incur interest at 5% per month.
        """
        result = await assess_document_risk(text)
        assert result.total_clauses >= 3
        assert result.high_risk_count >= 1  # At least indemnification
        assert "liability" in result.categories_found or "financial" in result.categories_found


# ── Edge Cases ────────────────────────────────────────────────────────────────

class TestEdgeCases:
    """Tests for edge cases and boundary conditions."""

    def test_unicode_text(self):
        text = "The vendor shall indemnify and hold harmless the client. 文字テスト"
        result = _assess_clause_risk(text, 1, 0, len(text))
        assert result.risk_level == "high"

    def test_very_long_clause(self):
        text = "The vendor shall indemnify and hold harmless. " * 1000
        result = _assess_clause_risk(text, 1, 0, len(text))
        assert result.risk_level == "high"
        # Text should be truncated to 500 chars in output
        assert len(result.text) <= 510

    def test_case_insensitive_matching(self):
        text = "THE VENDOR SHALL INDEMNIFY AND HOLD HARMLESS THE CLIENT."
        result = _assess_clause_risk(text, 1, 0, len(text))
        assert result.risk_level == "high"

    def test_clause_id_preserved(self):
        text = "The vendor shall indemnify and hold harmless the client."
        result = _assess_clause_risk(text, 42, 100, 100 + len(text))
        assert result.clause_id == 42
        assert result.start_offset == 100

    @pytest.mark.asyncio
    async def test_none_text_handled(self):
        """None/empty text should return empty result gracefully."""
        result = await assess_document_risk(None)
        assert result.total_clauses == 0
