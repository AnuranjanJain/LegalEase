"""
Tests for database health check utility.
"""

import pytest
from unittest.mock import MagicMock, patch
from backend.utils.db_health import check_database_health, wait_for_database


def test_check_database_health_success():
    """Test successful database health check."""
    mock_db = MagicMock()
    mock_db.execute.return_value = None
    
    result = check_database_health(mock_db)
    
    assert result is True
    mock_db.execute.assert_called_once()


def test_check_database_health_failure():
    """Test failed database health check."""
    mock_db = MagicMock()
    mock_db.execute.side_effect = Exception("Connection error")
    
    result = check_database_health(mock_db)
    
    assert result is False


@patch('backend.utils.db_health.SessionLocal')
def test_wait_for_database_success(mock_session_class):
    """Test waiting for database successfully."""
    mock_session = MagicMock()
    mock_session_class.return_value = mock_session
    mock_session.execute.return_value = None
    
    result = wait_for_database(max_retries=3, delay=0.01)
    
    assert result is True
    mock_session_class.assert_called_once()


@patch('backend.utils.db_health.SessionLocal')
def test_wait_for_database_failure(mock_session_class):
    """Test waiting for database with failure."""
    mock_session = MagicMock()
    mock_session_class.return_value = mock_session
    mock_session.execute.side_effect = Exception("Connection error")
    
    result = wait_for_database(max_retries=3, delay=0.01)
    
    assert result is False
    assert mock_session_class.call_count == 3
