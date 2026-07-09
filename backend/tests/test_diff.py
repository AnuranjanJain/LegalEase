"""
test_diff.py
────────────
Unit tests for:
  - diff_service.compute_diff()
  - POST /compare/diff endpoint (FastAPI TestClient)
"""

from __future__ import annotations

import pytest
from unittest.mock import MagicMock

from fastapi.testclient import TestClient


# ---------------------------------------------------------------------------
# Tests for compute_diff()
# ---------------------------------------------------------------------------

class TestComputeDiff:

    def test_identical_text_returns_single_equal_segment(self):
        from backend.services.diff_service import compute_diff
        result = compute_diff("The parties agree to terms.", "The parties agree to terms.")
        assert len(result["segments"]) == 1
        assert result["segments"][0]["type"] == "equal"
        assert result["stats"]["added_words"] == 0
        assert result["stats"]["removed_words"] == 0
        assert result["stats"]["similarity_ratio"] == 1.0

    def test_completely_different_text(self):
        from backend.services.diff_service import compute_diff
        result = compute_diff("Alpha beta gamma", "Delta epsilon zeta")
        types = {seg["type"] for seg in result["segments"]}
        assert "removed" in types
        assert "added" in types
        assert result["stats"]["removed_words"] == 3
        assert result["stats"]["added_words"] == 3

    def test_word_insertion_detected(self):
        from backend.services.diff_service import compute_diff
        result = compute_diff(
            "The employee shall maintain confidentiality.",
            "The employee shall maintain strict confidentiality.",
        )
        added_segments = [s["text"] for s in result["segments"] if s["type"] == "added"]
        assert any("strict" in s for s in added_segments)
        assert result["stats"]["added_words"] == 1

    def test_word_removal_detected(self):
        from backend.services.diff_service import compute_diff
        result = compute_diff(
            "Either party may terminate this agreement immediately.",
            "Either party may terminate this agreement.",
        )
        removed_segments = [s["text"] for s in result["segments"] if s["type"] == "removed"]
        assert any("immediately" in s for s in removed_segments)
        assert result["stats"]["removed_words"] == 1

    def test_reconstructs_original_from_equal_and_removed_segments(self):
        from backend.services.diff_service import compute_diff
        original = "Termination requires 30 days written notice by either party."
        revised = "Termination requires 60 days advance written notice by either party."
        result = compute_diff(original, revised)

        reconstructed_original = "".join(
            seg["text"] for seg in result["segments"] if seg["type"] in ("equal", "removed")
        )
        reconstructed_revised = "".join(
            seg["text"] for seg in result["segments"] if seg["type"] in ("equal", "added")
        )
        assert reconstructed_original == original
        assert reconstructed_revised == revised

    def test_empty_documents(self):
        from backend.services.diff_service import compute_diff
        result = compute_diff("", "")
        assert result["segments"] == []
        assert result["stats"]["similarity_ratio"] == 1.0

    def test_one_empty_document(self):
        from backend.services.diff_service import compute_diff
        result = compute_diff("Some contract text here.", "")
        assert all(seg["type"] == "removed" for seg in result["segments"])
        assert result["stats"]["removed_words"] == 4
        assert result["stats"]["added_words"] == 0


# ---------------------------------------------------------------------------
# Tests for POST /compare/diff endpoint
# ---------------------------------------------------------------------------

@pytest.fixture
def client():
    """TestClient with auth bypassed via a stub token."""
    import backend.config
    backend.config._settings = None
    from backend.main import app
    from backend.auth import validate_token_or_api_key, AuthIdentity
    from backend.routers.compare_routes import validate_token_or_api_key as compare_auth

    stub_identity = MagicMock(spec=AuthIdentity)
    stub_identity.get_rate_limit_key.return_value = "test_user"

    app.dependency_overrides[validate_token_or_api_key] = lambda: stub_identity
    app.dependency_overrides[compare_auth] = lambda: stub_identity
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.clear()


class TestDiffEndpoint:

    def test_returns_200_with_valid_payload(self, client):
        payload = {
            "original_document": {"id": "doc_v1", "name": "Contract v1.pdf", "text": "The term is 12 months."},
            "revised_document": {"id": "doc_v2", "name": "Contract v2.pdf", "text": "The term is 24 months."},
        }
        resp = client.post("/compare/diff", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert "segments" in data
        assert "stats" in data
        types = {seg["type"] for seg in data["segments"]}
        assert "removed" in types
        assert "added" in types

    def test_returns_422_for_missing_document_id(self, client):
        payload = {
            "original_document": {"id": "", "name": "V1.pdf", "text": "text"},
            "revised_document": {"id": "doc_v2", "name": "V2.pdf", "text": "text"},
        }
        resp = client.post("/compare/diff", json=payload)
        assert resp.status_code == 422

    def test_identical_documents_have_no_added_or_removed(self, client):
        payload = {
            "original_document": {"id": "doc_v1", "name": "V1.pdf", "text": "Same contract text."},
            "revised_document": {"id": "doc_v2", "name": "V2.pdf", "text": "Same contract text."},
        }
        resp = client.post("/compare/diff", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["stats"]["added_words"] == 0
        assert data["stats"]["removed_words"] == 0
        assert data["stats"]["similarity_ratio"] == 1.0

    def test_returns_429_when_rate_limited(self, client):
        from backend.routers.compare_routes import _compare_limiter

        payload = {
            "original_document": {"id": "doc_v1", "name": "V1.pdf", "text": "text one"},
            "revised_document": {"id": "doc_v2", "name": "V2.pdf", "text": "text two"},
        }
        original_check = _compare_limiter.check
        _compare_limiter.check = lambda key: {"allowed": False}
        try:
            resp = client.post("/compare/diff", json=payload)
            assert resp.status_code == 429
        finally:
            _compare_limiter.check = original_check
