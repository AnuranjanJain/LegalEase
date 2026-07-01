import os
import pytest
from unittest.mock import Mock, patch
from fastapi import status
from httpx import AsyncClient, ASGITransport
from backend.main import app
from backend.services.ai_service import ai_service
import backend.config

# Reset settings before any tests
backend.config._settings = None

# Set JWT_SECRET_KEY for tests
os.environ["JWT_SECRET_KEY"] = "testing-secret-key-1234567890-abcdef"

@pytest.mark.asyncio
async def test_ai_service_analyze_clauses_stub_mode():
    """Test analyze_clauses returns standard mock data in stub mode"""
    with patch.dict(os.environ, {"STUB_MODE": "true", "JWT_SECRET_KEY": "testing-secret-key-1234567890-abcdef"}):
        import backend.config
        backend.config._settings = None
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
    
    with patch.dict(os.environ, {"STUB_MODE": "true", "JWT_SECRET_KEY": "testing-secret-key-1234567890-abcdef"}):
        import backend.config
        backend.config._settings = None
        ai_service.__init__()
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            r = await ac.post("/legal/analyze-clauses", json=payload, headers=headers)
            assert r.status_code == status.HTTP_200_OK
            data = r.json()
            assert "clauses" in data
            assert len(data["clauses"]) == 3
            assert data["clauses"][0]["riskLevel"] == "High"
        ai_service.__init__()


@pytest.mark.unit
def test_parse_clauses_json_valid_response():
    """Test parsing valid JSON response"""
    valid_json = '[{"clause": "Test clause", "riskLevel": "High", "riskReason": "Test reason"}]'
    clauses = ai_service._parse_clauses_json(valid_json)
    assert len(clauses) == 1
    assert clauses[0]["clause"] == "Test clause"
    assert clauses[0]["riskLevel"] == "High"
    assert clauses[0]["riskReason"] == "Test reason"


@pytest.mark.unit
def test_parse_clauses_json_markdown_response():
    """Test parsing JSON from markdown code blocks"""
    markdown_json = '''```json
[{"clause": "Test clause", "riskLevel": "High", "riskReason": "Test reason"}]
```'''
    clauses = ai_service._parse_clauses_json(markdown_json)
    assert len(clauses) == 1
    assert clauses[0]["clause"] == "Test clause"


@pytest.mark.unit
def test_parse_clauses_json_leading_trailing_text():
    """Test parsing JSON with leading and trailing explanatory text"""
    text_with_explanation = '''Here are the clauses:
[{"clause": "Test clause", "riskLevel": "High", "riskReason": "Test reason"}]
Hope this helps.'''
    clauses = ai_service._parse_clauses_json(text_with_explanation)
    assert len(clauses) == 1
    assert clauses[0]["clause"] == "Test clause"


@pytest.mark.unit
def test_parse_clauses_json_multiple_arrays():
    """Test parsing JSON with multiple arrays (should extract first)"""
    multiple_arrays = '''[{"clause": "First clause", "riskLevel": "High", "riskReason": "First"}]
Some text
[{"clause": "Second clause", "riskLevel": "Low", "riskReason": "Second"}]'''
    clauses = ai_service._parse_clauses_json(multiple_arrays)
    assert len(clauses) == 1
    assert clauses[0]["clause"] == "First clause"


@pytest.mark.unit
def test_parse_clauses_json_trailing_commas():
    """Test parsing JSON with trailing commas"""
    trailing_commas = '[{"clause": "Test clause", "riskLevel": "High", "riskReason": "Test reason",},]'
    clauses = ai_service._parse_clauses_json(trailing_commas)
    assert len(clauses) == 1
    assert clauses[0]["clause"] == "Test clause"


@pytest.mark.unit
def test_parse_clauses_json_nested_objects():
    """Test parsing JSON with nested objects"""
    nested_objects = '''[{"clause": "Test clause", "riskLevel": "High", "riskReason": "Test reason", "metadata": {"key": "value", "nested": {"deep": "value"}}}]'''
    clauses = ai_service._parse_clauses_json(nested_objects)
    assert len(clauses) == 1
    assert clauses[0]["clause"] == "Test clause"


@pytest.mark.unit
def test_parse_clauses_json_empty_response():
    """Test parsing empty response raises ValueError"""
    with pytest.raises(ValueError, match="Empty response"):
        ai_service._parse_clauses_json("")


@pytest.mark.unit
def test_parse_clauses_json_whitespace_only():
    """Test parsing whitespace-only response raises ValueError"""
    with pytest.raises(ValueError, match="Empty response"):
        ai_service._parse_clauses_json("   ")


@pytest.mark.unit
def test_parse_clauses_json_invalid_json():
    """Test parsing invalid JSON raises ValueError"""
    with pytest.raises(ValueError, match="Invalid JSON response"):
        ai_service._parse_clauses_json("This is not JSON at all")


@pytest.mark.unit
def test_parse_clauses_json_partial_response():
    """Test parsing partial/incomplete JSON raises ValueError"""
    partial_json = '[{"clause": "Test clause", "risk'
    with pytest.raises(ValueError, match="Invalid JSON response"):
        ai_service._parse_clauses_json(partial_json)


@pytest.mark.unit
def test_parse_clauses_json_risk_level_normalization():
    """Test risk level normalization (invalid levels default to Low)"""
    invalid_risk = '[{"clause": "Test", "riskLevel": "INVALID", "riskReason": "Test"}]'
    clauses = ai_service._parse_clauses_json(invalid_risk)
    assert len(clauses) == 1
    assert clauses[0]["riskLevel"] == "Low"


@pytest.mark.unit
def test_parse_clauses_json_risk_level_case_insensitive():
    """Test risk level is case-insensitive"""
    lowercase_risk = '[{"clause": "Test", "riskLevel": "high", "riskReason": "Test"}]'
    clauses = ai_service._parse_clauses_json(lowercase_risk)
    assert len(clauses) == 1
    assert clauses[0]["riskLevel"] == "High"


@pytest.mark.unit
def test_parse_clauses_json_missing_risk_reason():
    """Test missing riskReason gets default value"""
    missing_reason = '[{"clause": "Test", "riskLevel": "High"}]'
    clauses = ai_service._parse_clauses_json(missing_reason)
    assert len(clauses) == 1
    assert clauses[0]["riskReason"] == "Analyzed clause."


@pytest.mark.unit
def test_parse_clauses_json_missing_clause_key():
    """Test items without clause key are skipped"""
    missing_clause = '[{"riskLevel": "High", "riskReason": "Test"}]'
    clauses = ai_service._parse_clauses_json(missing_clause)
    assert len(clauses) == 0


@pytest.mark.unit
def test_extract_json_array_balanced_simple():
    """Test balanced bracket extraction with simple array"""
    text = 'Some text [{"clause": "Test"}] more text'
    result = ai_service._extract_json_array_balanced(text)
    assert result == '[{"clause": "Test"}]'


@pytest.mark.unit
def test_extract_json_array_balanced_nested():
    """Test balanced bracket extraction with nested objects"""
    text = 'Text [{"clause": "Test", "meta": {"key": "value"}}] end'
    result = ai_service._extract_json_array_balanced(text)
    assert result == '[{"clause": "Test", "meta": {"key": "value"}}]'


@pytest.mark.unit
def test_extract_json_array_balanced_nested_arrays():
    """Test balanced bracket extraction with nested arrays"""
    text = 'Text [{"clause": "Test", "items": [1, 2, 3]}] end'
    result = ai_service._extract_json_array_balanced(text)
    assert result == '[{"clause": "Test", "items": [1, 2, 3]}]'


@pytest.mark.unit
def test_extract_json_array_balanced_strings_with_brackets():
    """Test balanced bracket extraction ignores brackets in strings"""
    text = 'Text [{"clause": "Test [bracket]", "risk": "High"}] end'
    result = ai_service._extract_json_array_balanced(text)
    assert result == '[{"clause": "Test [bracket]", "risk": "High"}]'


@pytest.mark.unit
def test_extract_json_array_balanced_no_bracket():
    """Test balanced bracket extraction returns None when no bracket found"""
    text = 'No brackets here'
    result = ai_service._extract_json_array_balanced(text)
    assert result is None


@pytest.mark.unit
def test_extract_json_array_balanced_unbalanced():
    """Test balanced bracket extraction returns None for unbalanced brackets"""
    text = 'Text [{"clause": "Test"} unbalanced'
    result = ai_service._extract_json_array_balanced(text)
    assert result is None


@pytest.mark.unit
def test_clean_json_string_trailing_commas():
    """Test JSON string cleaning removes trailing commas"""
    json_with_commas = '[{"clause": "Test", "riskLevel": "High",},]'
    cleaned = ai_service._clean_json_string(json_with_commas)
    # The cleaned string should be valid JSON
    import json
    parsed = json.loads(cleaned)
    assert parsed == [{"clause": "Test", "riskLevel": "High"}]


@pytest.mark.unit
def test_extract_from_markdown_json_block():
    """Test markdown extraction from json code block"""
    markdown = '```json\n[{"clause": "Test"}]\n```'
    result = ai_service._extract_from_markdown(markdown)
    assert result == '[{"clause": "Test"}]'


@pytest.mark.unit
def test_extract_from_markdown_text_block():
    """Test markdown extraction from text code block"""
    markdown = '```text\n[{"clause": "Test"}]\n```'
    result = ai_service._extract_from_markdown(markdown)
    assert result == '[{"clause": "Test"}]'


@pytest.mark.unit
def test_extract_from_markdown_no_language():
    """Test markdown extraction from code block without language"""
    markdown = '```\n[{"clause": "Test"}]\n```'
    result = ai_service._extract_from_markdown(markdown)
    assert result == '[{"clause": "Test"}]'


@pytest.mark.unit
def test_extract_from_markdown_no_markdown():
    """Test markdown extraction returns original when no markdown present"""
    no_markdown = '[{"clause": "Test"}]'
    result = ai_service._extract_from_markdown(no_markdown)
    assert result == '[{"clause": "Test"}]'


@pytest.mark.unit
def test_validate_and_normalize_clauses_valid():
    """Test validation with valid clauses"""
    parsed = [{"clause": "Test", "riskLevel": "High", "riskReason": "Reason"}]
    result = ai_service._validate_and_normalize_clauses(parsed)
    assert len(result) == 1
    assert result[0]["clause"] == "Test"
    assert result[0]["riskLevel"] == "High"


@pytest.mark.unit
def test_validate_and_normalize_clauses_non_dict_items():
    """Test validation skips non-dict items"""
    parsed = [{"clause": "Test"}, "string", 123, None]
    result = ai_service._validate_and_normalize_clauses(parsed)
    assert len(result) == 1


@pytest.mark.unit
def test_validate_and_normalize_clauses_empty_list():
    """Test validation with empty list"""
    result = ai_service._validate_and_normalize_clauses([])
    assert result == []


@pytest.mark.asyncio
async def test_ai_service_analyze_clauses_valid_json_output():
    """Test analyze_clauses with valid JSON output from mock"""
    mock_run = Mock(output='[{"clause": "Test clause", "riskLevel": "High", "riskReason": "Test reason"}]')
    
    with patch.object(ai_service, "_execute_with_retry_and_timeout", return_value=mock_run):
        with patch.object(ai_service, "stub_mode", False):
            clauses = await ai_service.analyze_clauses("Some text")
            assert len(clauses) == 1
            assert clauses[0]["clause"] == "Test clause"
            assert clauses[0]["riskLevel"] == "High"


@pytest.mark.asyncio
async def test_ai_service_analyze_clauses_markdown_output():
    """Test analyze_clauses with markdown-wrapped JSON output"""
    mock_run = Mock(output='```json\n[{"clause": "Test", "riskLevel": "High", "riskReason": "Test"}]\n```')
    
    with patch.object(ai_service, "_execute_with_retry_and_timeout", return_value=mock_run):
        with patch.object(ai_service, "stub_mode", False):
            clauses = await ai_service.analyze_clauses("Some text")
            assert len(clauses) == 1
            assert clauses[0]["clause"] == "Test"


@pytest.mark.asyncio
async def test_ai_service_analyze_clauses_with_explanatory_text():
    """Test analyze_clauses with explanatory text around JSON"""
    mock_run = Mock(output='Here are the clauses:\n[{"clause": "Test", "riskLevel": "High", "riskReason": "Test"}]\nHope this helps.')

    with patch.object(ai_service, "_execute_with_retry_and_timeout", return_value=mock_run):
        with patch.object(ai_service, "stub_mode", False):
            clauses = await ai_service.analyze_clauses("Some text")
            assert len(clauses) == 1
            assert clauses[0]["clause"] == "Test"


@pytest.mark.unit
def test_chunk_text_for_clause_analysis_short_text_single_chunk():
    """Short documents should not be split at all."""
    with patch.object(ai_service, "max_model_input_chars", 5000):
        chunks = ai_service._chunk_text_for_clause_analysis("Short contract text.")
        assert len(chunks) == 1
        assert chunks[0] == "Short contract text."


@pytest.mark.unit
def test_chunk_text_for_clause_analysis_long_text_multiple_chunks():
    """Long documents should be split into multiple chunks instead of truncated."""
    with patch.object(ai_service, "max_model_input_chars", 2000):
        long_text = "Clause text. " * 200  # ~2600 chars
        chunks = ai_service._chunk_text_for_clause_analysis(long_text)
        assert len(chunks) > 1
        # Every character of the original document must be preserved across chunks.
        assert "".join(chunks) == long_text


@pytest.mark.unit
def test_chunk_text_for_clause_analysis_caps_chunk_count():
    """An extremely long document is capped to avoid unbounded AI calls."""
    with patch.object(ai_service, "max_model_input_chars", 600):
        huge_text = "Clause text. " * 5000  # ~65000 chars
        chunks = ai_service._chunk_text_for_clause_analysis(huge_text)
        assert len(chunks) == ai_service._MAX_CLAUSE_ANALYSIS_CHUNKS


@pytest.mark.asyncio
async def test_analyze_clauses_merges_results_across_chunks():
    """Clauses found in later chunks of a long document must not be dropped."""
    call_count = {"n": 0}

    async def fake_execute(model_name, messages):
        call_count["n"] += 1
        clause_text = f"Clause from chunk {call_count['n']}"
        return Mock(output=f'[{{"clause": "{clause_text}", "riskLevel": "High", "riskReason": "Test"}}]')

    with patch.object(ai_service, "max_model_input_chars", 1000):
        with patch.object(ai_service, "stub_mode", False):
            with patch.object(ai_service, "_execute_with_retry_and_timeout", side_effect=fake_execute):
                long_text = "Clause text. " * 200
                clauses = await ai_service.analyze_clauses(long_text)
                assert len(clauses) == call_count["n"]
                assert call_count["n"] > 1
                assert clauses[0]["clause"] == "Clause from chunk 1"
                assert clauses[-1]["clause"] == f"Clause from chunk {call_count['n']}"


@pytest.mark.asyncio
async def test_analyze_clauses_partial_chunk_failure_keeps_successful_results():
    """If one chunk's AI call fails, clauses from other chunks are still returned."""
    call_count = {"n": 0}

    async def fake_execute(model_name, messages):
        call_count["n"] += 1
        if call_count["n"] == 1:
            raise RuntimeError("Provider error on first chunk")
        clause_text = f"Clause from chunk {call_count['n']}"
        return Mock(output=f'[{{"clause": "{clause_text}", "riskLevel": "High", "riskReason": "Test"}}]')

    with patch.object(ai_service, "max_model_input_chars", 1000):
        with patch.object(ai_service, "stub_mode", False):
            with patch.object(ai_service, "_execute_with_retry_and_timeout", side_effect=fake_execute):
                long_text = "Clause text. " * 200
                clauses = await ai_service.analyze_clauses(long_text)
                assert call_count["n"] > 1
                assert len(clauses) == call_count["n"] - 1
                assert all("Clause from chunk" in c["clause"] for c in clauses)


@pytest.mark.asyncio
async def test_analyze_clauses_injects_jurisdiction_into_prompt():
    """The jurisdiction parameter must reach the prompt sent to the model."""
    captured_messages = {}

    async def fake_execute(model_name, messages):
        captured_messages["messages"] = messages
        return Mock(output='[{"clause": "Test", "riskLevel": "High", "riskReason": "Test"}]')

    with patch.object(ai_service, "stub_mode", False):
        with patch.object(ai_service, "_execute_with_retry_and_timeout", side_effect=fake_execute):
            await ai_service.analyze_clauses("Some clause text.", jurisdiction="California Law")
            prompt_content = captured_messages["messages"][0]["content"]
            assert "California Law" in prompt_content


@pytest.mark.asyncio
async def test_analyze_clauses_default_jurisdiction_when_unspecified():
    """Omitting jurisdiction should fall back to the general default, matching chat/compare."""
    captured_messages = {}

    async def fake_execute(model_name, messages):
        captured_messages["messages"] = messages
        return Mock(output='[{"clause": "Test", "riskLevel": "High", "riskReason": "Test"}]')

    with patch.object(ai_service, "stub_mode", False):
        with patch.object(ai_service, "_execute_with_retry_and_timeout", side_effect=fake_execute):
            await ai_service.analyze_clauses("Some clause text.")
            prompt_content = captured_messages["messages"][0]["content"]
            assert "General / Not Specified" in prompt_content


@pytest.mark.asyncio
async def test_analyze_clauses_endpoint_rejects_invalid_jurisdiction():
    """POST /legal/analyze-clauses must reject an unsupported jurisdiction with 400."""
    headers = {"x-api-key": "dev-token"}
    payload = {"text": "Subscriber shall indemnify Provider.", "jurisdiction": "Nonexistent Legal System"}

    with patch.dict(os.environ, {"STUB_MODE": "true", "ALLOW_DEV": "true", "JWT_SECRET_KEY": "testing-secret-key-1234567890-abcdef"}):
        import backend.config
        backend.config._settings = None
        ai_service.__init__()
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            r = await ac.post("/legal/analyze-clauses", json=payload, headers=headers)
            assert r.status_code == status.HTTP_400_BAD_REQUEST
        ai_service.__init__()
