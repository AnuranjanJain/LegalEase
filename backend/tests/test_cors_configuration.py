"""
Tests for explicit CORS configuration.

These tests verify that localhost origins are only added when explicitly configured
via ALLOW_LOCALHOST_CORS, ensuring security hardening and predictable behavior.
"""
import pytest
import os
from unittest.mock import patch
import backend.config

# Set environment variables for tests
os.environ["JWT_SECRET_KEY"] = "testing-secret-key-1234567890-abcdef"
os.environ["TEST_MODE"] = "true"
os.environ["ENVIRONMENT"] = "testing"


@pytest.fixture(autouse=True, scope="module")
def restore_backend_main_after_cors_tests():
    yield
    os.environ["JWT_SECRET_KEY"] = "testing-secret-key-1234567890-abcdef"
    os.environ["TEST_MODE"] = "true"
    os.environ["ENVIRONMENT"] = "testing"
    import backend.config
    backend.config._settings = None
    import backend.main as main_module
    from importlib import reload
    reload(main_module)


@pytest.mark.unit
def test_cors_localhost_not_added_by_default():
    """Test that localhost origins are NOT added by default in any environment"""
    with patch.dict(os.environ, {
        "ENVIRONMENT": "development",
        "ALLOWED_ORIGINS": "https://example.com",
        "ALLOW_LOCALHOST_CORS": "false",
        "TEST_MODE": "true",
        "JWT_SECRET_KEY": "test-secret-key"
    }):
        # Re-import to pick up new environment variables
        from importlib import reload
        import backend.main as main_module
        reload(main_module)
        
        # Check that localhost origins were NOT added
        assert "http://localhost:5173" not in main_module.ALLOWED_ORIGINS
        assert "http://localhost:5174" not in main_module.ALLOWED_ORIGINS
        assert "http://127.0.0.1:5173" not in main_module.ALLOWED_ORIGINS
        # Only explicitly configured origin should be present
        assert "https://example.com" in main_module.ALLOWED_ORIGINS
        assert len(main_module.ALLOWED_ORIGINS) == 1


@pytest.mark.unit
def test_cors_localhost_added_when_explicitly_enabled():
    """Test that localhost origins are added when ALLOW_LOCALHOST_CORS=true"""
    with patch.dict(os.environ, {
        "ENVIRONMENT": "development",
        "ALLOWED_ORIGINS": "https://example.com",
        "ALLOW_LOCALHOST_CORS": "true",
        "TEST_MODE": "true",
        "JWT_SECRET_KEY": "test-secret-key"
    }):
        from importlib import reload
        import backend.main as main_module
        reload(main_module)
        
        # Check that localhost origins were added
        assert "http://localhost:5173" in main_module.ALLOWED_ORIGINS
        assert "http://localhost:5174" in main_module.ALLOWED_ORIGINS
        assert "http://localhost:5180" in main_module.ALLOWED_ORIGINS
        assert "http://127.0.0.1:5173" in main_module.ALLOWED_ORIGINS
        assert "http://127.0.0.1:5180" in main_module.ALLOWED_ORIGINS
        assert "https://example.com" in main_module.ALLOWED_ORIGINS


@pytest.mark.unit
def test_cors_localhost_disabled_in_production():
    """Test that localhost origins are NOT added in production even if enabled"""
    with patch.dict(os.environ, {
        "ENVIRONMENT": "staging",
        "ALLOWED_ORIGINS": "https://example.com",
        "ALLOW_LOCALHOST_CORS": "true",
        "DOCUMENT_ENCRYPTION_KEY": "test-encryption-key",
        "TEST_MODE": "true",
        "JWT_SECRET_KEY": "test-secret-key"
    }, clear=True):
        import sys
        if 'backend.main' in sys.modules:
            del sys.modules['backend.main']
        if 'backend.config' in sys.modules:
            del sys.modules['backend.config']
        from importlib import reload
        import backend.main as main_module
        reload(main_module)
        
        # Check that localhost origins were NOT added (production safety)
        assert "http://localhost:5173" not in main_module.ALLOWED_ORIGINS
        assert "http://127.0.0.1:5173" not in main_module.ALLOWED_ORIGINS
        # Only explicitly configured origin should be present
        assert "https://example.com" in main_module.ALLOWED_ORIGINS
        assert len(main_module.ALLOWED_ORIGINS) == 1


@pytest.mark.unit
def test_cors_production_does_not_inject_localhost():
    """Test that production environment does NOT add localhost origins"""
    with patch.dict(os.environ, {
        "ENVIRONMENT": "staging",
        "ALLOWED_ORIGINS": "https://example.com",
        "DOCUMENT_ENCRYPTION_KEY": "test-encryption-key",
        "TEST_MODE": "true",
        "JWT_SECRET_KEY": "test-secret-key"
    }, clear=True):
        import sys
        if 'backend.main' in sys.modules:
            del sys.modules['backend.main']
        if 'backend.config' in sys.modules:
            del sys.modules['backend.config']
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
def test_cors_empty_allowed_origins_with_localhost_enabled():
    """Test that empty ALLOWED_ORIGINS with localhost enabled still adds localhost"""
    with patch.dict(os.environ, {
        "ENVIRONMENT": "development",
        "ALLOWED_ORIGINS": "",
        "ALLOW_LOCALHOST_CORS": "true",
        "JWT_SECRET_KEY": "test-secret-key"
    }):
        from importlib import reload
        import backend.main as main_module
        reload(main_module)
        
        # Should add localhost origins
        assert "http://localhost:5173" in main_module.ALLOWED_ORIGINS
        assert "http://127.0.0.1:5173" in main_module.ALLOWED_ORIGINS


@pytest.mark.unit
def test_cors_empty_allowed_origins_without_localhost_enabled():
    """Test that empty ALLOWED_ORIGINS without localhost enabled results in no origins"""
    with patch.dict(os.environ, {
        "ENVIRONMENT": "development",
        "ALLOWED_ORIGINS": "",
        "ALLOW_LOCALHOST_CORS": "false",
        "FRONTEND_URL": "",
        "JWT_SECRET_KEY": "test-secret-key"
    }):
        from importlib import reload
        import backend.main as main_module
        reload(main_module)
        
        # Should have no origins (empty list)
        assert len(main_module.ALLOWED_ORIGINS) == 0


@pytest.mark.unit
def test_cors_multiple_origins_preserved():
    """Test that multiple configured origins are preserved"""
    with patch.dict(os.environ, {
        "ENVIRONMENT": "development",
        "ALLOWED_ORIGINS": "https://example.com,https://app.example.com,https://api.example.com",
        "ALLOW_LOCALHOST_CORS": "false",
        "TEST_MODE": "true",
        "JWT_SECRET_KEY": "test-secret-key"
    }, clear=True):
        import sys
        if 'backend.main' in sys.modules:
            del sys.modules['backend.main']
        if 'backend.config' in sys.modules:
            del sys.modules['backend.config']
        from importlib import reload
        import backend.main as main_module
        reload(main_module)
        
        # All configured origins should be present
        assert "https://example.com" in main_module.ALLOWED_ORIGINS
        assert "https://app.example.com" in main_module.ALLOWED_ORIGINS
        assert "https://api.example.com" in main_module.ALLOWED_ORIGINS
        # NO localhost origins
        assert "http://localhost:5173" not in main_module.ALLOWED_ORIGINS
        assert "http://127.0.0.1:5173" not in main_module.ALLOWED_ORIGINS
        # Total should be exactly 3
        assert len(main_module.ALLOWED_ORIGINS) == 3


@pytest.mark.unit
def test_cors_frontend_url_fallback():
    """Test that FRONTEND_URL fallback works"""
    with patch.dict(os.environ, {
        "ENVIRONMENT": "development",
        "FRONTEND_URL": "https://frontend.example.com",
        "ALLOWED_ORIGINS": "",
        "ALLOW_LOCALHOST_CORS": "false",
        "JWT_SECRET_KEY": "test-secret-key",
        "TEST_MODE": "true"
    }, clear=True):
        import sys
        if 'backend.main' in sys.modules:
            del sys.modules['backend.main']
        if 'backend.config' in sys.modules:
            del sys.modules['backend.config']
        from importlib import reload
        import backend.main as main_module
        reload(main_module)
        
        # Should use FRONTEND_URL
        assert "https://frontend.example.com" in main_module.ALLOWED_ORIGINS
        # NO localhost
        assert "http://localhost:5173" not in main_module.ALLOWED_ORIGINS


@pytest.mark.unit
def test_cors_duplicate_origins_removed():
    """Test that duplicate origins are removed from the list"""
    with patch.dict(os.environ, {
        "ENVIRONMENT": "development",
        "ALLOWED_ORIGINS": "http://localhost:5173,https://example.com,http://localhost:5173",
        "ALLOW_LOCALHOST_CORS": "false",
        "JWT_SECRET_KEY": "test-secret-key",
        "TEST_MODE": "true"
    }, clear=True):
        import sys
        if 'backend.main' in sys.modules:
            del sys.modules['backend.main']
        if 'backend.config' in sys.modules:
            del sys.modules['backend.config']
        from importlib import reload
        import backend.main as main_module
        reload(main_module)
        
        # Should remove duplicate localhost:5173
        localhost_count = main_module.ALLOWED_ORIGINS.count("http://localhost:5173")
        assert localhost_count == 1
        assert "https://example.com" in main_module.ALLOWED_ORIGINS


@pytest.mark.unit
def test_cors_whitespace_handling():
    """Test that whitespace in origins is properly handled"""
    with patch.dict(os.environ, {
        "ENVIRONMENT": "development",
        "ALLOWED_ORIGINS": " https://example.com , https://app.example.com ",
        "ALLOW_LOCALHOST_CORS": "false",
        "TEST_MODE": "true",
        "JWT_SECRET_KEY": "test-secret-key"
    }, clear=True):
        import sys
        if 'backend.main' in sys.modules:
            del sys.modules['backend.main']
        if 'backend.config' in sys.modules:
            del sys.modules['backend.config']
        from importlib import reload
        import backend.main as main_module
        reload(main_module)
        
        # Whitespace should be stripped
        assert "https://example.com" in main_module.ALLOWED_ORIGINS
        assert "https://app.example.com" in main_module.ALLOWED_ORIGINS
        # No localhost
        assert "http://localhost:5173" not in main_module.ALLOWED_ORIGINS


@pytest.mark.unit
def test_cors_invalid_origins_ignored():
    """Test that invalid origins (missing scheme) are ignored safely"""
    with patch.dict(os.environ, {
        "ENVIRONMENT": "development",
        "ALLOWED_ORIGINS": "https://example.com,invalid-origin,no-scheme.com,https://valid.com",
        "ALLOW_LOCALHOST_CORS": "false",
        "TEST_MODE": "true",
        "JWT_SECRET_KEY": "test-secret-key"
    }, clear=True):
        import sys
        if 'backend.main' in sys.modules:
            del sys.modules['backend.main']
        if 'backend.config' in sys.modules:
            del sys.modules['backend.config']
        from importlib import reload
        import backend.main as main_module
        reload(main_module)
        
        # Only valid origins should be present
        assert "https://example.com" in main_module.ALLOWED_ORIGINS
        assert "https://valid.com" in main_module.ALLOWED_ORIGINS
        assert "invalid-origin" not in main_module.ALLOWED_ORIGINS
        assert "no-scheme.com" not in main_module.ALLOWED_ORIGINS


@pytest.mark.unit
def test_cors_localhost_ports_range():
    """Test that all expected localhost ports are added when enabled"""
    with patch.dict(os.environ, {
        "ENVIRONMENT": "development",
        "ALLOWED_ORIGINS": "https://example.com",
        "ALLOW_LOCALHOST_CORS": "true",
        "TEST_MODE": "true",
        "JWT_SECRET_KEY": "test-secret-key"
    }):
        from importlib import reload
        import backend.main as main_module
        reload(main_module)
        
        # Check all ports in range 5173-5180
        expected_ports = range(5173, 5181)
        for host in ["http://localhost", "http://127.0.0.1"]:
            for port in expected_ports:
                assert f"{host}:{port}" in main_module.ALLOWED_ORIGINS


@pytest.mark.security
def test_cors_security_production_no_localhost():
    """Security test: Verify production never allows localhost origins"""
    # Test various production-like configurations
    test_configs = [
        {"ENVIRONMENT": "staging", "ALLOWED_ORIGINS": "https://example.com"},
        {"ENVIRONMENT": "staging", "ALLOWED_ORIGINS": "", "FRONTEND_URL": ""},
        {"ENVIRONMENT": "staging", "ALLOWED_ORIGINS": "https://example.com,https://app.example.com"},
    ]
    
    for config in test_configs:
        config["JWT_SECRET_KEY"] = "test-secret-key"
        config["DOCUMENT_ENCRYPTION_KEY"] = "test-encryption-key"
        config["TEST_MODE"] = "true"
        config["ALLOW_LOCALHOST_CORS"] = "true"  # Even if enabled, should be ignored in production
        with patch.dict(os.environ, config, clear=True):
                import sys
                if 'backend.main' in sys.modules:
                    del sys.modules['backend.main']
                if 'backend.config' in sys.modules:
                    del sys.modules['backend.config']
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
        "ENVIRONMENT": "staging",
        "ALLOWED_ORIGINS": configured_origins,
        "DOCUMENT_ENCRYPTION_KEY": "test-encryption-key",
        "TEST_MODE": "true",
        "JWT_SECRET_KEY": "test-secret-key",
        "ALLOW_LOCALHOST_CORS": "true"
    }, clear=True):
        import sys
        if 'backend.main' in sys.modules:
            del sys.modules['backend.main']
        if 'backend.config' in sys.modules:
            del sys.modules['backend.config']
        from importlib import reload
        import backend.main as main_module
        reload(main_module)
        
        # Runtime origins should exactly match configured origins
        assert set(main_module.ALLOWED_ORIGINS) == set(configured_list)
        assert len(main_module.ALLOWED_ORIGINS) == len(configured_list)


@pytest.mark.regression
def test_cors_regression_development_workflow_with_explicit_config():
    """Regression test: Ensure development workflow works with explicit config"""
    with patch.dict(os.environ, {
        "ENVIRONMENT": "development",
        "ALLOWED_ORIGINS": "http://localhost:5173",
        "ALLOW_LOCALHOST_CORS": "true"
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
def test_cors_regression_no_automatic_injection():
    """Regression test: Ensure localhost is never automatically injected"""
    # Test all environments to ensure no automatic injection
    environments = ["development", "testing", "local", "staging", "production"]
    
    for env in environments:
        env_config = {
            "ENVIRONMENT": env,
            "ALLOWED_ORIGINS": "https://example.com",
            "ALLOW_LOCALHOST_CORS": "false",
            "JWT_SECRET_KEY": "test-secret-key",
            "DOCUMENT_ENCRYPTION_KEY": "test-encryption-key",
            "REQUIRE_REDIS_IN_PRODUCTION": "false",
        }
        # Only enable TEST_MODE in non-production environments
        if env != "production":
            env_config["TEST_MODE"] = "true"
        
        with patch.dict(os.environ, env_config, clear=True):
            import sys
            if 'backend.main' in sys.modules:
                del sys.modules['backend.main']
            if 'backend.config' in sys.modules:
                del sys.modules['backend.config']
            from importlib import reload
            import backend.main as main_module
            reload(main_module)
            
            # Verify no localhost origins
            assert "http://localhost:5173" not in main_module.ALLOWED_ORIGINS
            assert "http://127.0.0.1:5173" not in main_module.ALLOWED_ORIGINS


@pytest.mark.unit
def test_cors_default_environment_is_production():
    """Test that default environment (no ENVIRONMENT) is production"""
    with patch.dict(os.environ, {
        "ALLOWED_ORIGINS": "https://example.com",
        "JWT_SECRET_KEY": "test-secret-key",
        "DOCUMENT_ENCRYPTION_KEY": "test-encryption-key",
        "REQUIRE_REDIS_IN_PRODUCTION": "false"
    }, clear=True):
            import backend.config
            backend.config._settings = None
            from importlib import reload
            import backend.main as main_module
            reload(main_module)

            # Should default to production behavior (secure)
            assert "http://localhost:5173" not in main_module.ALLOWED_ORIGINS
            assert "https://example.com" in main_module.ALLOWED_ORIGINS


@pytest.mark.regression
def test_cors_regression_configured_origins_unchanged():
    """Regression test: Ensure configured ALLOWED_ORIGINS remain unchanged"""
    configured_origins = "https://example.com,https://app.example.com,https://api.example.com"
    
    with patch.dict(os.environ, {
        "ENVIRONMENT": "development",
        "ALLOWED_ORIGINS": configured_origins,
        "ALLOW_LOCALHOST_CORS": "true",
        "TEST_MODE": "true",
        "JWT_SECRET_KEY": "test-secret-key"
    }, clear=True):
        import sys
        if 'backend.main' in sys.modules:
            del sys.modules['backend.main']
        if 'backend.config' in sys.modules:
            del sys.modules['backend.config']
        from importlib import reload
        import backend.main as main_module
        reload(main_module)
        
        # All configured origins should still be present
        assert "https://example.com" in main_module.ALLOWED_ORIGINS
        assert "https://app.example.com" in main_module.ALLOWED_ORIGINS
        assert "https://api.example.com" in main_module.ALLOWED_ORIGINS
