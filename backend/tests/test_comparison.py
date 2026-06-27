"""
test_comparison.py
──────────────────
Unit tests for:
  - comparison_service.build_comparison_context()
  - comparison_service.build_comparison_prompt()
  - ComparisonService.compare_documents() (mocked AI)
  - POST /compare/chat endpoint (FastAPI TestClient)

Run with:
  cd backend && python -m pytest tests/test_comparison.py -v
"""

from __future__ import annotations

import os
import json
import pytest
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient


# ---------------------------------------------------------------------------
# Fixtures — shared document payloads
# ---------------------------------------------------------------------------

NDA = {"id": "doc_nda", "name": "NDA.pdf", "text": "The parties agree to maintain confidentiality for a period of 5 years. Either party may terminate this agreement with 30 days written notice."}
EMPLOYMENT = {"id": "doc_emp", "name": "Employment Agreement.docx", "text": "The employee shall maintain confidentiality indefinitely. Termination requires 60 days written notice by either party."}
SERVICE = {"id": "doc_svc", "name": "Service Contract.pdf", "text": "Service provider agrees to keep all client information strictly confidential with no expiration. Termination clause: 90 days advance notice required."}


# ---------------------------------------------------------------------------
# Tests for build_comparison_context()
# ---------------------------------------------------------------------------

class TestBuildComparisonContext:

    def test_raises_with_single_document(self):
        from backend.services.comparison_service import build_comparison_context
        with pytest.raises(ValueError, match="At least 2 documents"):
            build_comparison_context([NDA])

    def test_raises_with_zero_documents(self):
        from backend.services.comparison_service import build_comparison_context
        with pytest.raises(ValueError, match="At least 2 documents"):
            build_comparison_context([])

    def test_raises_when_exceeding_max_documents(self):
        from backend.services.comparison_service import build_comparison_context, MAX_DOCUMENTS
        docs = [{"id": f"doc_{i}", "name": f"Doc{i}.pdf", "text": "text"} for i in range(MAX_DOCUMENTS + 1)]
        with pytest.raises(ValueError, match="Cannot compare more than"):
            build_comparison_context(docs)

    def test_contains_document_names_as_headers(self):
        from backend.services.comparison_service import build_comparison_context
        result = build_comparison_context([NDA, EMPLOYMENT])
        assert "DOCUMENT: NDA.pdf" in result
        assert "DOCUMENT: Employment Agreement.docx" in result

    def test_contains_document_text_content(self):
        from backend.services.comparison_service import build_comparison_context
        result = build_comparison_context([NDA, EMPLOYMENT])
        assert "confidentiality" in result
        assert "termination" in result.lower()

    def test_documents_separated_by_divider(self):
        from backend.services.comparison_service import build_comparison_context
        result = build_comparison_context([NDA, EMPLOYMENT])
        # Separator line between documents
        assert "---" in result

    def test_empty_text_documents_handled_gracefully(self):
        from backend.services.comparison_service import build_comparison_context
        empty_doc = {"id": "doc_empty", "name": "Empty.pdf", "text": ""}
        result = build_comparison_context([NDA, empty_doc])
        assert "DOCUMENT: Empty.pdf" in result
        assert "No text content available" in result

    def test_three_documents_all_appear(self):
        from backend.services.comparison_service import build_comparison_context
        result = build_comparison_context([NDA, EMPLOYMENT, SERVICE])
        assert "DOCUMENT: NDA.pdf" in result
        assert "DOCUMENT: Employment Agreement.docx" in result
        assert "DOCUMENT: Service Contract.pdf" in result

    def test_text_truncated_to_budget(self):
        from backend.services.comparison_service import build_comparison_context
        # 300 char budget total, 2 docs → 150 chars each
        long_text = "A" * 500
        doc_a = {"id": "a", "name": "A.pdf", "text": long_text}
        doc_b = {"id": "b", "name": "B.pdf", "text": long_text}
        result = build_comparison_context([doc_a, doc_b], max_chars=300)
        # Neither document should contribute 500 chars
        assert result.count("A" * 200) == 0  # 200-char run never present
        assert "truncated" in result

    def test_respects_custom_max_chars(self):
        from backend.services.comparison_service import build_comparison_context
        doc_a = {"id": "a", "name": "A.pdf", "text": "X" * 2000}
        doc_b = {"id": "b", "name": "B.pdf", "text": "Y" * 2000}
        result = build_comparison_context([doc_a, doc_b], max_chars=500)
        assert len(result) < 2000  # Well within a reasonable bound

    def test_none_text_treated_as_empty(self):
        from backend.services.comparison_service import build_comparison_context
        none_doc = {"id": "doc_none", "name": "None.pdf", "text": None}
        result = build_comparison_context([NDA, none_doc])
        assert "No text content available" in result


# ---------------------------------------------------------------------------
# Tests for build_comparison_prompt()
# ---------------------------------------------------------------------------

class TestBuildComparisonPrompt:

    def test_contains_system_prompt_heading(self):
        from backend.services.comparison_service import build_comparison_prompt
        result = build_comparison_prompt("Compare confidentiality clauses", [NDA, EMPLOYMENT])
        assert "legal document comparison assistant" in result.lower()

    def test_contains_user_message(self):
        from backend.services.comparison_service import build_comparison_prompt
        result = build_comparison_prompt("Compare confidentiality clauses", [NDA, EMPLOYMENT])
        assert "Compare confidentiality clauses" in result

    def test_contains_document_section_header(self):
        from backend.services.comparison_service import build_comparison_prompt
        result = build_comparison_prompt("Any question", [NDA, EMPLOYMENT])
        assert "DOCUMENTS FOR COMPARISON" in result

    def test_includes_conversation_history(self):
        from backend.services.comparison_service import build_comparison_prompt
        history = [
            {"role": "user", "content": "What is an NDA?"},
            {"role": "assistant", "content": "An NDA is a confidentiality agreement."},
        ]
        result = build_comparison_prompt("Compare them now", [NDA, EMPLOYMENT], history=history)
        assert "What is an NDA?" in result
        assert "confidentiality agreement" in result

    def test_history_section_header_present(self):
        from backend.services.comparison_service import build_comparison_prompt
        history = [{"role": "user", "content": "hello"}]
        result = build_comparison_prompt("Q", [NDA, EMPLOYMENT], history=history)
        assert "CONVERSATION HISTORY" in result

    def test_no_history_section_when_none(self):
        from backend.services.comparison_service import build_comparison_prompt
        result = build_comparison_prompt("Q", [NDA, EMPLOYMENT], history=None)
        assert "CONVERSATION HISTORY" not in result

    def test_format_sections_in_system_prompt(self):
        from backend.services.comparison_service import build_comparison_prompt, COMPARISON_SYSTEM_PROMPT
        assert "## Summary" in COMPARISON_SYSTEM_PROMPT
        assert "## Similarities" in COMPARISON_SYSTEM_PROMPT
        assert "## Differences" in COMPARISON_SYSTEM_PROMPT
        assert "## Potential Conflicts" in COMPARISON_SYSTEM_PROMPT
        assert "## Recommendations" in COMPARISON_SYSTEM_PROMPT

    def test_history_truncated_to_last_six_turns(self):
        from backend.services.comparison_service import build_comparison_prompt
        history = [
            {"role": "user", "content": f"message_{i}"}
            for i in range(10)
        ]
        result = build_comparison_prompt("Q", [NDA, EMPLOYMENT], history=history)
        # Only last 6 messages should be included
        assert "message_9" in result
        assert "message_4" in result
        # Earlier messages should be excluded
        assert "message_0" not in result
        assert "message_3" not in result


# ---------------------------------------------------------------------------
# Tests for ComparisonService.compare_documents()
# ---------------------------------------------------------------------------

class TestComparisonServiceCompareDocuments:

    @pytest.mark.asyncio
    async def test_raises_with_single_document(self):
        from backend.services.comparison_service import ComparisonService
        svc = ComparisonService()
        with pytest.raises(ValueError, match="At least 2 documents"):
            await svc.compare_documents("Q", [NDA])

    @pytest.mark.asyncio
    async def test_returns_ai_response(self):
        from backend.services.comparison_service import ComparisonService

        async def fake_generate(*args, **kwargs):
            yield "## Summary\n\nBoth documents contain confidentiality clauses."

        with patch(
            "backend.services.ai_service.ai_service.generate_chat_response",
            side_effect=fake_generate,
        ):
            svc = ComparisonService()
            result = await svc.compare_documents("Compare them", [NDA, EMPLOYMENT])

        assert "Summary" in result
        assert "confidentiality" in result.lower()

    @pytest.mark.asyncio
    async def test_returns_fallback_on_empty_ai_response(self):
        from backend.services.comparison_service import ComparisonService

        async def empty_generate(*args, **kwargs):
            yield ""

        with patch(
            "backend.services.ai_service.ai_service.generate_chat_response",
            side_effect=empty_generate,
        ):
            svc = ComparisonService()
            result = await svc.compare_documents("Compare them", [NDA, EMPLOYMENT])

        # Falls back to the graceful degradation response
        assert "fallback" in result.lower() or "unavailable" in result.lower()

    @pytest.mark.asyncio
    async def test_passes_document_names_to_prompt(self):
        from backend.services.comparison_service import ComparisonService

        captured_prompt = {}

        async def capturing_generate(message, *args, **kwargs):
            captured_prompt["prompt"] = message
            yield "OK"

        with patch(
            "backend.services.ai_service.ai_service.generate_chat_response",
            side_effect=capturing_generate,
        ):
            svc = ComparisonService()
            await svc.compare_documents("Compare", [NDA, EMPLOYMENT])

        assert "NDA.pdf" in captured_prompt["prompt"]
        assert "Employment Agreement.docx" in captured_prompt["prompt"]

    @pytest.mark.asyncio
    async def test_three_documents_all_referenced_in_prompt(self):
        from backend.services.comparison_service import ComparisonService

        captured = {}

        async def cap(message, *args, **kwargs):
            captured["p"] = message
            yield "done"

        with patch(
            "backend.services.ai_service.ai_service.generate_chat_response",
            side_effect=cap,
        ):
            svc = ComparisonService()
            await svc.compare_documents("Compare all", [NDA, EMPLOYMENT, SERVICE])

        assert "NDA.pdf" in captured["p"]
        assert "Employment Agreement.docx" in captured["p"]
        assert "Service Contract.pdf" in captured["p"]


# ---------------------------------------------------------------------------
# Tests for POST /compare/chat endpoint
# ---------------------------------------------------------------------------

@pytest.fixture
def client():
    """TestClient with auth bypassed via a stub token."""
    import backend.config
    backend.config._settings = None
    from backend.main import app
    from backend.auth import validate_token_or_api_key, AuthIdentity

    # Minimal auth stub
    stub_identity = MagicMock(spec=AuthIdentity)
    stub_identity.get_rate_limit_key.return_value = "test_user"

    app.dependency_overrides[validate_token_or_api_key] = lambda: stub_identity
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.clear()


VALID_PAYLOAD = {
    "message": "Compare the confidentiality clauses",
    "document_texts": [
        {"id": "doc_nda", "name": "NDA.pdf", "text": NDA["text"]},
        {"id": "doc_emp", "name": "Employment Agreement.docx", "text": EMPLOYMENT["text"]},
    ],
}


class TestCompareEndpoint:

    def test_returns_200_with_valid_payload(self, client):
        from backend.services.comparison_service import comparison_service

        async def mock_compare(*args, **kwargs):
            return "## Summary\n\nBoth docs require confidentiality."

        with patch.object(comparison_service, "compare_documents", side_effect=mock_compare):
            resp = client.post("/compare/chat", json=VALID_PAYLOAD)

        assert resp.status_code == 200
        data = resp.json()
        assert "response" in data
        assert "confidentiality" in data["response"].lower()

    def test_returns_422_when_only_one_document(self, client):
        payload = {
            "message": "Compare",
            "document_texts": [
                {"id": "doc_nda", "name": "NDA.pdf", "text": "text"},
            ],
        }
        resp = client.post("/compare/chat", json=payload)
        assert resp.status_code == 422  # Pydantic validation catches min_length=2

    def test_returns_422_when_message_is_empty(self, client):
        payload = {
            "message": "",
            "document_texts": [
                {"id": "doc_nda", "name": "NDA.pdf", "text": "text"},
                {"id": "doc_emp", "name": "Emp.docx", "text": "text"},
            ],
        }
        resp = client.post("/compare/chat", json=payload)
        assert resp.status_code == 422

    def test_returns_422_for_missing_document_id(self, client):
        payload = {
            "message": "Compare",
            "document_texts": [
                {"name": "NDA.pdf", "text": "text"},  # missing 'id'
                {"id": "doc_emp", "name": "Emp.docx", "text": "text"},
            ],
        }
        resp = client.post("/compare/chat", json=payload)
        assert resp.status_code == 422

    def test_returns_422_for_duplicate_document_ids(self, client):
        payload = {
            "message": "Compare",
            "document_texts": [
                {"id": "doc_same", "name": "A.pdf", "text": "text A"},
                {"id": "doc_same", "name": "B.pdf", "text": "text B"},
            ],
        }
        resp = client.post("/compare/chat", json=payload)
        assert resp.status_code == 422

    def test_accepts_three_documents(self, client):
        from backend.services.comparison_service import comparison_service

        async def mock_compare(*args, **kwargs):
            return "## Summary\n\nThree documents compared."

        payload = {
            "message": "Compare all three",
            "document_texts": [
                {"id": "doc_nda", "name": "NDA.pdf", "text": NDA["text"]},
                {"id": "doc_emp", "name": "Employment.docx", "text": EMPLOYMENT["text"]},
                {"id": "doc_svc", "name": "Service.pdf", "text": SERVICE["text"]},
            ],
        }
        with patch.object(comparison_service, "compare_documents", side_effect=mock_compare):
            resp = client.post("/compare/chat", json=payload)

        assert resp.status_code == 200
        assert "Three documents" in resp.json()["response"]

    def test_accepts_optional_conversation_history(self, client):
        from backend.services.comparison_service import comparison_service

        received_history = {}

        async def capturing_compare(message, documents, history=None):
            received_history["h"] = history
            return "ok"

        payload = {
            **VALID_PAYLOAD,
            "conversation_history": [
                {"role": "user", "content": "What is an NDA?"},
                {"role": "assistant", "content": "A confidentiality agreement."},
            ],
        }

        with patch.object(comparison_service, "compare_documents", side_effect=capturing_compare):
            resp = client.post("/compare/chat", json=payload)

        assert resp.status_code == 200
        assert received_history["h"] is not None
        assert len(received_history["h"]) == 2

    def test_returns_502_when_service_raises_unexpected_error(self, client):
        from backend.services.comparison_service import comparison_service

        async def failing_compare(*args, **kwargs):
            raise RuntimeError("Unexpected provider failure")

        with patch.object(comparison_service, "compare_documents", side_effect=failing_compare):
            resp = client.post("/compare/chat", json=VALID_PAYLOAD)

        assert resp.status_code == 502

    def test_returns_400_when_service_raises_value_error(self, client):
        from backend.services.comparison_service import comparison_service

        async def bad_compare(*args, **kwargs):
            raise ValueError("At least 2 documents are required.")

        with patch.object(comparison_service, "compare_documents", side_effect=bad_compare):
            resp = client.post("/compare/chat", json=VALID_PAYLOAD)

        assert resp.status_code == 400
        assert "2 documents" in resp.json().get("detail", "")

    def test_response_shape_contains_response_key(self, client):
        from backend.services.comparison_service import comparison_service

        async def mock_compare(*args, **kwargs):
            return "## Summary\nTest response"

        with patch.object(comparison_service, "compare_documents", side_effect=mock_compare):
            resp = client.post("/compare/chat", json=VALID_PAYLOAD)

        assert resp.status_code == 200
        body = resp.json()
        assert set(body.keys()) == {"response"}

    def test_documents_with_empty_text_are_accepted(self, client):
        """Empty text is valid — the service handles the no-content case."""
        from backend.services.comparison_service import comparison_service

        async def mock_compare(*args, **kwargs):
            return "## Summary\nOne doc has no text."

        payload = {
            "message": "Compare",
            "document_texts": [
                {"id": "doc_nda", "name": "NDA.pdf", "text": NDA["text"]},
                {"id": "doc_empty", "name": "Empty.pdf", "text": ""},
            ],
        }
        with patch.object(comparison_service, "compare_documents", side_effect=mock_compare):
            resp = client.post("/compare/chat", json=payload)

        assert resp.status_code == 200
