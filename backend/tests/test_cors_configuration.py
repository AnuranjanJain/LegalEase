"""
Tests for environment-aware CORS configuration.

These tests verify that localhost origins are only added in development/testing/local
environments and not in production, ensuring security hardening.
"""
import pytest
import os
from unittest.mock import patch


@pytest.mark.unit
def test_cors_development_environment_injects_localhost():
    """Test that development environment automatically adds localhost origins"""
    with patch.dict(os.environ, {
        "ENVIRONMENT": "development",
        "ALLOWED_ORIGINS": "https://example.com"
    }):
        # Re-import to pick up new environment variables
        from importlib import reload
        import backend.main as main_module
        reload(main_module)
        
        # Check that localhost origins were added
        assert "http://localhost:5173" in main_module.ALLOWED_ORIGINS
        assert "http://localhost:5174" in main_module.ALLOWED_ORIGINS
        assert "http://127.0.0.1:5173" in main_module.ALLOWED_ORIGINS
        assert "https://example.com" in main_module.ALLOWED_ORIGINS


@pytest.mark.unit
def test_cors_testing_environment_injects_localhost():
    """Test that testing environment automatically adds localhost origins"""
    with patch.dict(os.environ, {
        "ENVIRONMENT": "testing",
        "ALLOWED_ORIGINS": "https://example.com"
    }):
        from importlib import reload
        import backend.main as main_module
        reload(main_module)
        
        # Check that localhost origins were added
        assert "http://localhost:5173" in main_module.ALLOWED_ORIGINS
        assert "http://127.0.0.1:5173" in main_module.ALLOWED_ORIGINS
        assert "https://example.com" in main_module.ALLOWED_ORIGINS


@pytest.mark.unit
def test_cors_local_environment_injects_localhost():
    """Test that local environment automatically adds localhost origins"""
    with patch.dict(os.environ, {
        "ENVIRONMENT": "local",
        "ALLOWED_ORIGINS": "https://example.com"
    }):
        from importlib import reload
        import backend.main as main_module
        reload(main_module)
        
        # Check that localhost origins were added
        assert "http://localhost:5173" in main_module.ALLOWED_ORIGINS
        assert "http://127.0.0.1:5173" in main_module.ALLOWED_ORIGINS
        assert "https://example.com" in main_module.ALLOWED_ORIGINS


@pytest.mark.unit
def test_cors_production_does_not_inject_localhost():
    """Test that production environment does NOT add localhost origins"""
    with patch.dict(os.environ, {
        "ENVIRONMENT": "production",
        "ALLOWED_ORIGINS": "https://example.com"
    }):
        from importlib import reload
        import backend.main as main_module
        reload(main_module)
        
        # Check that localhost origins were NOT added
        assert "http://localhost:5173" not in main_module.ALLOWED_ORIGINS
        assert "http://127.0.0.1:5173" not in main_module.ALLOWED_ORIGINS
        # Only explicitly configured origin should be present
        assert "https://example.com" in main_module.ALLOWED_ORIGINS
        assert len(main_module.ALLOWED_ORIGINS) == 1


@pytest.mark.unit
def test_cors_staging_does_not_inject_localhost():
    """Test that staging environment does NOT add localhost origins"""
    with patch.dict(os.environ, {
        "ENVIRONMENT": "staging",
        "ALLOWED_ORIGINS": "https://staging.example.com"
    }):
        from importlib import reload
        import backend.main as main_module
        reload(main_module)
        
        # Check that localhost origins were NOT added
        assert "http://localhost:5173" not in main_module.ALLOWED_ORIGINS
        assert "http://127.0.0.1:5173" not in main_module.ALLOWED_ORIGINS
        assert "https://staging.example.com" in main_module.ALLOWED_ORIGINS


@pytest.mark.unit
def test_cors_default_environment_is_production():
    """Test that default environment (no ENVIRONMENT set) is production"""
    with patch.dict(os.environ, {}, clear=True):
        with patch.dict(os.environ, {
            "ALLOWED_ORIGINS": "https://example.com",
            "JWT_SECRET_KEY": "test-secret-key"
        }):
            from importlib import reload
            import backend.main as main_module
            reload(main_module)
            
            # Should behave like production - no localhost injection
            assert "http://localhost:5173" not in main_module.ALLOWED_ORIGINS
            assert "https://example.com" in main_module.ALLOWED_ORIGINS


@pytest.mark.unit
def test_cors_empty_allowed_origins_in_development():
    """Test that empty ALLOWED_ORIGINS in development still adds localhost"""
    with patch.dict(os.environ, {
        "ENVIRONMENT": "development",
        "ALLOWED_ORIGINS": ""
    }):
        from importlib import reload
        import backend.main as main_module
        reload(main_module)
        
        # Should still add localhost origins
        assert "http://localhost:5173" in main_module.ALLOWED_ORIGINS
        assert "http://127.0.0.1:5173" in main_module.ALLOWED_ORIGINS


@pytest.mark.unit
def test_cors_empty_allowed_origins_in_production():
    """Test that empty ALLOWED_ORIGINS in production results in no origins"""
    with patch.dict(os.environ, {}, clear=True):
        with patch.dict(os.environ, {
            "ENVIRONMENT": "production",
            "ALLOWED_ORIGINS": "",
            "FRONTEND_URL": "",
            "JWT_SECRET_KEY": "test-secret-key"
        }):
            from importlib import reload
            import backend.main as main_module
            reload(main_module)
            
            # Should have no origins (empty list)
            assert len(main_module.ALLOWED_ORIGINS) == 0


@pytest.mark.unit
def test_cors_multiple_origins_in_development():
    """Test that multiple configured origins are preserved in development"""
    with patch.dict(os.environ, {
        "ENVIRONMENT": "development",
        "ALLOWED_ORIGINS": "https://example.com,https://app.example.com,https://api.example.com"
    }):
        from importlib import reload
        import backend.main as main_module
        reload(main_module)
        
        # All configured origins should be present
        assert "https://example.com" in main_module.ALLOWED_ORIGINS
        assert "https://app.example.com" in main_module.ALLOWED_ORIGINS
        assert "https://api.example.com" in main_module.ALLOWED_ORIGINS
        # Plus localhost origins
        assert "http://localhost:5173" in main_module.ALLOWED_ORIGINS


@pytest.mark.unit
def test_cors_multiple_origins_in_production():
    """Test that multiple configured origins are preserved in production without localhost"""
    with patch.dict(os.environ, {
        "ENVIRONMENT": "production",
        "ALLOWED_ORIGINS": "https://example.com,https://app.example.com,https://api.example.com"
    }):
        from importlib import reload
        import backend.main as main_module
        reload(main_module)
        
        # All configured origins should be present
        assert "https://example.com" in main_module.ALLOWED_ORIGINS
        assert "https://app.example.com" in main_module.ALLOWED_ORIGINS
        assert "https://api.example.com" in main_module.ALLOWED_ORIGINS
        # But NO localhost origins
        assert "http://localhost:5173" not in main_module.ALLOWED_ORIGINS
        assert "http://127.0.0.1:5173" not in main_module.ALLOWED_ORIGINS
        # Total should be exactly 3
        assert len(main_module.ALLOWED_ORIGINS) == 3


@pytest.mark.unit
def test_cors_frontend_url_fallback_in_development():
    """Test that FRONTEND_URL fallback works in development"""
    with patch.dict(os.environ, {
        "ENVIRONMENT": "development",
        "FRONTEND_URL": "https://frontend.example.com",
        "ALLOWED_ORIGINS": "",
        "JWT_SECRET_KEY": "test-secret-key"
    }, clear=True):
        # Remove ALLOWED_ORIGINS to test fallback
        with patch.dict(os.environ, {}, clear=False):
            from importlib import reload
            import backend.main as main_module
            reload(main_module)
            
            # Should use FRONTEND_URL and add localhost
            assert "https://frontend.example.com" in main_module.ALLOWED_ORIGINS
            assert "http://localhost:5173" in main_module.ALLOWED_ORIGINS


@pytest.mark.unit
def test_cors_case_insensitive_environment():
    """Test that environment variable is case-insensitive"""
    with patch.dict(os.environ, {
        "ENVIRONMENT": "DEVELOPMENT",
        "ALLOWED_ORIGINS": "https://example.com"
    }):
        from importlib import reload
        import backend.main as main_module
        reload(main_module)
        
        # Should treat uppercase as development and add localhost
        assert "http://localhost:5173" in main_module.ALLOWED_ORIGINS


@pytest.mark.unit
def test_cors_duplicate_origins_not_added():
    """Test that duplicate origins are not added to the list"""
    with patch.dict(os.environ, {
        "ENVIRONMENT": "development",
        "ALLOWED_ORIGINS": "http://localhost:5173,https://example.com"
    }):
        from importlib import reload
        import backend.main as main_module
        reload(main_module)
        
        # Should not add duplicate localhost:5173
        # Count occurrences
        localhost_count = main_module.ALLOWED_ORIGINS.count("http://localhost:5173")
        assert localhost_count == 1
        assert "https://example.com" in main_module.ALLOWED_ORIGINS


@pytest.mark.unit
def test_cors_whitespace_handling():
    """Test that whitespace in origins is properly handled"""
    with patch.dict(os.environ, {
        "ENVIRONMENT": "production",
        "ALLOWED_ORIGINS": " https://example.com , https://app.example.com "
    }):
        from importlib import reload
        import backend.main as main_module
        reload(main_module)
        
        # Whitespace should be stripped
        assert "https://example.com" in main_module.ALLOWED_ORIGINS
        assert "https://app.example.com" in main_module.ALLOWED_ORIGINS
        # No localhost in production
        assert "http://localhost:5173" not in main_module.ALLOWED_ORIGINS


@pytest.mark.security
def test_cors_security_production_no_localhost():
    """Security test: Verify production never allows localhost origins"""
    # Test various production-like configurations
    test_configs = [
        {"ENVIRONMENT": "production", "ALLOWED_ORIGINS": "https://example.com"},
        {"ENVIRONMENT": "production", "ALLOWED_ORIGINS": "", "FRONTEND_URL": ""},
        {"ENVIRONMENT": "production", "ALLOWED_ORIGINS": "https://example.com,https://app.example.com"},
    ]
    
    for config in test_configs:
        with patch.dict(os.environ, {}, clear=True):
            config["JWT_SECRET_KEY"] = "test-secret-key"
            with patch.dict(os.environ, config):
                from importlib import reload
                import backend.main as main_module
                reload(main_module)
                
                # Verify no localhost origins in any form
                for origin in main_module.ALLOWED_ORIGINS:
                    assert "localhost" not in origin.lower()
                    assert "127.0.0.1" not in origin


@pytest.mark.security
def test_cors_security_configured_origins_only_in_production():
    """Security test: Verify production only allows explicitly configured origins"""
    configured_origins = "https://example.com,https://app.example.com"
    configured_list = [o.strip() for o in configured_origins.split(",")]
    
    with patch.dict(os.environ, {
        "ENVIRONMENT": "production",
        "ALLOWED_ORIGINS": configured_origins
    }):
        from importlib import reload
        import backend.main as main_module
        reload(main_module)
        
        # Runtime origins should exactly match configured origins
        assert set(main_module.ALLOWED_ORIGINS) == set(configured_list)
        assert len(main_module.ALLOWED_ORIGINS) == len(configured_list)


@pytest.mark.regression
def test_cors_regression_development_workflow():
    """Regression test: Ensure existing development workflow still works"""
    with patch.dict(os.environ, {
        "ENVIRONMENT": "development",
        "ALLOWED_ORIGINS": "http://localhost:5173"
    }):
        from importlib import reload
        import backend.main as main_module
        reload(main_module)
        
        # Vite dev server ports should be available
        assert "http://localhost:5173" in main_module.ALLOWED_ORIGINS
        assert "http://localhost:5174" in main_module.ALLOWED_ORIGINS
        assert "http://localhost:5175" in main_module.ALLOWED_ORIGINS
        assert "http://127.0.0.1:5173" in main_module.ALLOWED_ORIGINS


@pytest.mark.regression
def test_cors_regression_default_behavior():
    """Regression test: Ensure default behavior (no ENVIRONMENT) is secure"""
    with patch.dict(os.environ, {}, clear=True):
        with patch.dict(os.environ, {
            "ALLOWED_ORIGINS": "https://example.com",
            "JWT_SECRET_KEY": "test-secret-key"
        }):
            from importlib import reload
            import backend.main as main_module
            reload(main_module)
            
            # Should default to production behavior (secure)
            assert "http://localhost:5173" not in main_module.ALLOWED_ORIGINS
            assert "https://example.com" in main_module.ALLOWED_ORIGINS
