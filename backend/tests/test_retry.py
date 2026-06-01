"""
Tests for retry utility.
"""

import pytest
from unittest.mock import MagicMock, patch
from backend.utils.retry import retry_on_database_error


def test_retry_success_on_first_attempt():
    """Test that function succeeds on first attempt."""
    mock_func = MagicMock(return_value="success")
    
    @retry_on_database_error(max_retries=3, delay=0.01)
    def test_function():
        return mock_func()
    
    result = test_function()
    
    assert result == "success"
    assert mock_func.call_count == 1


def test_retry_success_on_second_attempt():
    """Test that function succeeds on second attempt."""
    mock_func = MagicMock(side_effect=[Exception("Temporary error"), "success"])
    
    @retry_on_database_error(max_retries=3, delay=0.01)
    def test_function():
        return mock_func()
    
    result = test_function()
    
    assert result == "success"
    assert mock_func.call_count == 2


def test_retry_failure_after_max_retries():
    """Test that function fails after max retries."""
    mock_func = MagicMock(side_effect=Exception("Persistent error"))
    
    @retry_on_database_error(max_retries=3, delay=0.01)
    def test_function():
        return mock_func()
    
    with pytest.raises(Exception, match="Persistent error"):
        test_function()
    
    assert mock_func.call_count == 4  # 1 initial + 3 retries


def test_retry_with_specific_exceptions():
    """Test that retry only catches specific exceptions."""
    mock_func = MagicMock(side_effect=ValueError("Not caught"))
    
    @retry_on_database_error(max_retries=3, delay=0.01, exceptions=(TypeError,))
    def test_function():
        return mock_func()
    
    with pytest.raises(ValueError, match="Not caught"):
        test_function()
    
    assert mock_func.call_count == 1


def test_retry_with_backoff():
    """Test that retry uses backoff delay."""
    mock_func = MagicMock(side_effect=[Exception("Error 1"), Exception("Error 2"), "success"])
    
    @retry_on_database_error(max_retries=3, delay=0.01, backoff=2.0)
    def test_function():
        return mock_func()
    
    result = test_function()
    
    assert result == "success"
    assert mock_func.call_count == 3
