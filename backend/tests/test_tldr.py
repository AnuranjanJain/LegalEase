import pytest
from httpx import AsyncClient, ASGITransport
import backend.main as main
from backend.services.ai_service import ai_service


@pytest.mark.asyncio
async def test_tldr_extraction_fallback_stub():
    """Test AI service generate_tldr fallback/stub behavior"""
    sample_legal_text = (
        "This Agreement is entered into by and between Acme Corp and John Doe. "
        "Payment of $10,000 USD is due within 30 days of invoice. "
        "A late fee penalty of 1.5% per month will apply to overdue payments."
    )
    res = await ai_service.generate_tldr(sample_legal_text)
    assert isinstance(res, dict)
    assert "parties" in res
    assert "deadlines" in res
    assert "financials" in res
    assert "penalties" in res
    assert "key_takeaways" in res
    assert isinstance(res["key_takeaways"], list)


@pytest.mark.asyncio
async def test_tldr_endpoint_success():
    """Test /tldr endpoint with valid API key"""
    payload = {
        "text": "This contract is between Party A and Party B. Payment of $5,000 is due on May 1st. Failure to pay results in a $100 penalty."
    }
    headers = {"X-API-Key": "dev-token"}
    async with AsyncClient(transport=ASGITransport(app=main.app), base_url="http://test") as ac:
        response = await ac.post("/tldr", json=payload, headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "parties" in data
        assert "deadlines" in data
        assert "financials" in data
        assert "penalties" in data
        assert "key_takeaways" in data


@pytest.mark.asyncio
async def test_legal_tldr_router_endpoint():
    """Test /legal/tldr router endpoint"""
    payload = {
        "text": "Contract terms between Alpha Inc and Beta LLC."
    }
    headers = {"X-API-Key": "dev-token"}
    async with AsyncClient(transport=ASGITransport(app=main.app), base_url="http://test") as ac:
        response = await ac.post("/legal/tldr", json=payload, headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "parties" in data
        assert "deadlines" in data
