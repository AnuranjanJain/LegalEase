import pytest
from unittest.mock import Mock, patch
from fastapi import status
from httpx import AsyncClient, ASGITransport
import os

from backend.main import app
from backend.services.ai_service import ai_service

@pytest.mark.asyncio
async def test_ai_service_analyze_clauses_stub_mode():
    """Test analyze_clauses returns standard mock data in stub mode"""
    with patch.dict(os.environ, {"STUB_MODE": "true"}):
        ai_service.__init__()
        clauses = await ai_service.analyze_clauses("This is a sample contract text.")
        assert len(clauses) == 3
        assert clauses[0]["riskLevel"] == "High"
        assert "terminate" in clauses[0]["clause"]
        assert clauses[1]["riskLevel"] == "Medium"
        assert clauses[2]["riskLevel"] == "Low"
        ai_service.__init__()

@pytest.mark.asyncio
async def test_ai_service_analyze_clauses_empty_input():
    """Test analyze_clauses returns empty list on empty input"""
    clauses = await ai_service.analyze_clauses("")
    assert clauses == []
    clauses = await ai_service.analyze_clauses("   ")
    assert clauses == []

@pytest.mark.asyncio
async def test_ai_service_analyze_clauses_invalid_json():
    """Test that analyze_clauses handles invalid json output from AI service gracefully"""
    # Mock execute_with_retry_and_timeout to return invalid json
    mock_run = Mock(output="Not a JSON response")
    
    with patch.object(ai_service, "_execute_with_retry_and_timeout", return_value=mock_run):
        with patch.object(ai_service, "stub_mode", False):
            # Since graceful_degradation is True by default, it should degrade gracefully
            with patch.object(ai_service, "graceful_degradation", True):
                clauses = await ai_service.analyze_clauses("Some text")
                assert len(clauses) == 1
                assert clauses[0]["riskLevel"] == "High"
                assert "fallback" in clauses[0]["riskReason"]

            # If graceful_degradation is False, it should raise ValueError
            with patch.object(ai_service, "graceful_degradation", False):
                with pytest.raises(ValueError):
                    await ai_service.analyze_clauses("Some text")

@pytest.mark.asyncio
async def test_analyze_clauses_endpoint():
    """Test the POST /legal/analyze-clauses endpoint"""
    headers = {"x-api-key": "dev-token"}
    payload = {"text": "Subscriber shall indemnify Provider."}
    
    with patch.dict(os.environ, {"STUB_MODE": "true"}):
        ai_service.__init__()
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            r = await ac.post("/legal/analyze-clauses", json=payload, headers=headers)
            assert r.status_code == status.HTTP_200_OK
            data = r.json()
            assert "clauses" in data
            assert len(data["clauses"]) == 3
            assert data["clauses"][0]["riskLevel"] == "High"
        ai_service.__init__()
