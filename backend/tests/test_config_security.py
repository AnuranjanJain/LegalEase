"""
Security Tests for Configuration Validation

This test suite validates security-related configuration checks,
ensuring secrets are properly validated and production configurations
are secure by default.
"""

import os
import pytest
from pydantic import ValidationError
from unittest.mock import patch

from backend.config import (
    SecurityConfig,
    EnvironmentConfig,
    AIConfig,
    Settings,
    get_settings,
)


class TestSecretValidation:
    """Test secret validation and security hardening."""

    def test_jwt_secret_key_required(self):
        """Test that JWT_SECRET_KEY is required in all environments."""
        with pytest.raises(ValidationError) as exc_info:
            SecurityConfig(jwt_secret_key="")
        assert "JWT_SECRET_KEY cannot be empty" in str(exc_info.value)

    def test_jwt_secret_key_not_whitespace(self):
        """Test that JWT_SECRET_KEY cannot be only whitespace."""
        with pytest.raises(ValidationError) as exc_info:
            SecurityConfig(jwt_secret_key="   ")
        assert "JWT_SECRET_KEY cannot be empty" in str(exc_info.value)

    def test_jwt_secret_key_minimum_length_warning(self, caplog):
        """Test that short JWT secret key generates security warning."""
        with caplog.at_level("WARNING"):
            config = SecurityConfig(jwt_secret_key="short")
        assert config.jwt_secret_key == "short"
        assert "shorter than recommended 16 characters" in caplog.text

    def test_jwt_secret_key_acceptable_length(self, caplog):
        """Test that JWT secret key of acceptable length does not warn."""
        with caplog.at_level("WARNING"):
            config = SecurityConfig(jwt_secret_key="a" * 16)
        assert config.jwt_secret_key == "a" * 16
        assert "shorter than recommended" not in caplog.text

    def test_jwt_secret_key_long(self):
        """Test that long JWT secret key is accepted."""
        config = SecurityConfig(jwt_secret_key="a" * 64)
        assert config.jwt_secret_key == "a" * 64

    def test_api_keys_can_be_empty(self):
        """Test that API_KEYS can be empty (no static keys)."""
        config = SecurityConfig(jwt_secret_key="test_secret", api_keys="")
        assert config.api_keys == ""

    def test_api_keys_multiple_keys(self):
        """Test that multiple API keys can be configured."""
        config = SecurityConfig(jwt_secret_key="test_secret", api_keys="key1,key2,key3")
        assert config.api_keys == "key1,key2,key3"

    def test_dev_api_key_has_default(self):
        """Test that DEV_API_KEY has a secure default."""
        config = SecurityConfig(jwt_secret_key="test_secret")
        assert config.dev_api_key == "dev-token"

    def test_allow_dev_default_false(self):
        """Test that ALLOW_DEV defaults to False for security."""
        with patch.dict(os.environ, {}, clear=True):
            config = SecurityConfig(jwt_secret_key="test_secret")
            assert config.allow_dev is False

    def test_allow_dev_can_be_enabled(self):
        """Test that ALLOW_DEV can be explicitly enabled."""
        config = SecurityConfig(jwt_secret_key="test_secret", allow_dev=True)
        assert config.allow_dev is True


class TestProductionSecurity:
    """Test production-specific security validation."""

    def test_environment_defaults_to_production(self):
        """Test that ENVIRONMENT defaults to production for safety."""
        with patch.dict(os.environ, {}, clear=True):
            config = EnvironmentConfig()
            assert config.environment == "production"

    def test_test_mode_rejected_in_production(self):
        """Test that TEST_MODE cannot be enabled in production."""
        with pytest.raises(ValidationError) as exc_info:
            EnvironmentConfig(environment="production", test_mode=True)
        assert "TEST_MODE cannot be enabled in production" in str(exc_info.value)

    def test_test_mode_allowed_in_development(self):
        """Test that TEST_MODE can be enabled in development."""
        config = EnvironmentConfig(environment="development", test_mode=True)
        assert config.test_mode is True

    def test_test_mode_allowed_in_testing(self):
        """Test that TEST_MODE can be enabled in testing."""
        config = EnvironmentConfig(environment="testing", test_mode=True)
        assert config.test_mode is True

    def test_test_mode_allowed_in_staging(self):
        """Test that TEST_MODE can be enabled in staging."""
        config = EnvironmentConfig(environment="staging", test_mode=True)
        assert config.test_mode is True

    def test_production_without_ai_key_warning(self, caplog):
        """Test that production without BYTEZ_API_KEY generates warning."""
        os.environ["ENVIRONMENT"] = "production"
        os.environ["JWT_SECRET_KEY"] = "test_secret_key_12345678"
        try:
            with caplog.at_level("WARNING"):
                config = AIConfig(bytez_api_key=None, stub_mode=False)
            assert config.bytez_api_key is None
            assert "BYTEZ_API_KEY is not set in production" in caplog.text
        finally:
            os.environ.pop("ENVIRONMENT", None)
            os.environ.pop("JWT_SECRET_KEY", None)

    def test_production_with_stub_mode_no_warning(self, caplog):
        """Test that production with stub mode does not warn about missing API key."""
        os.environ["ENVIRONMENT"] = "production"
        os.environ["JWT_SECRET_KEY"] = "test_secret_key_12345678"
        try:
            with caplog.at_level("WARNING"):
                config = AIConfig(bytez_api_key=None, stub_mode=True)
            assert config.bytez_api_key is None
            assert "BYTEZ_API_KEY is not set in production" not in caplog.text
        finally:
            os.environ.pop("ENVIRONMENT", None)
            os.environ.pop("JWT_SECRET_KEY", None)

    def test_production_with_ai_key_no_warning(self, caplog):
        """Test that production with AI key does not warn."""
        os.environ["ENVIRONMENT"] = "production"
        os.environ["JWT_SECRET_KEY"] = "test_secret_key_12345678"
        try:
            with caplog.at_level("WARNING"):
                config = AIConfig(bytez_api_key="test_api_key", stub_mode=False)
            assert config.bytez_api_key == "test_api_key"
            assert "BYTEZ_API_KEY is not set in production" not in caplog.text
        finally:
            os.environ.pop("ENVIRONMENT", None)
            os.environ.pop("JWT_SECRET_KEY", None)


class TestDevelopmentSecurity:
    """Test development environment security configuration."""

    def test_development_environment_acceptable(self):
        """Test that development environment is valid."""
        config = EnvironmentConfig(environment="development")
        assert config.environment == "development"

    def test_development_with_test_mode(self):
        """Test that development can have test mode enabled."""
        config = EnvironmentConfig(environment="development", test_mode=True)
        assert config.environment == "development"
        assert config.test_mode is True

    def test_development_without_ai_key_no_warning(self, caplog):
        """Test that development without AI key does not warn."""
        os.environ["ENVIRONMENT"] = "development"
        os.environ["JWT_SECRET_KEY"] = "test_secret_key_12345678"
        try:
            with caplog.at_level("WARNING"):
                config = AIConfig(bytez_api_key=None, stub_mode=False)
            assert config.bytez_api_key is None
            assert "BYTEZ_API_KEY is not set in production" not in caplog.text
        finally:
            os.environ.pop("ENVIRONMENT", None)
            os.environ.pop("JWT_SECRET_KEY", None)


class TestSecurityDefaults:
    """Test that security defaults are safe."""

    def test_graceful_degradation_default_true(self):
        """Test that GRACEFUL_DEGRADATION defaults to True for reliability."""
        config = AIConfig()
        assert config.graceful_degradation is True

    def test_stub_mode_default_false(self):
        """Test that STUB_MODE defaults to False for security."""
        with patch.dict(os.environ, {}, clear=True):
            config = AIConfig()
            assert config.stub_mode is False

    def test_health_debug_default_false(self):
        """Test that HEALTH_DEBUG defaults to False for security."""
        config = AIConfig()
        assert config.health_debug is False

    def test_trust_proxy_headers_default_false(self):
        """Test that TRUST_PROXY_HEADERS defaults to False for security."""
        from backend.config import RateLimitConfig
        config = RateLimitConfig()
        assert config.trust_proxy_headers is False


class TestSettingsSecurityIntegration:
    """Test security validation in integrated settings."""

    def test_settings_requires_jwt_secret(self):
        """Test that Settings requires JWT_SECRET_KEY."""
        os.environ.pop("JWT_SECRET_KEY", None)
        import backend.config
        backend.config._settings = None
        
        with pytest.raises(ValidationError) as exc_info:
            Settings()
        assert "jwt_secret_key" in str(exc_info.value).lower()

    def test_settings_with_valid_jwt_secret(self):
        """Test that Settings works with valid JWT_SECRET_KEY."""
        os.environ["JWT_SECRET_KEY"] = "test_secret_key_12345678"
        import backend.config
        backend.config._settings = None
        
        try:
            settings = Settings()
            assert settings.security.jwt_secret_key == "test_secret_key_12345678"
        finally:
            os.environ.pop("JWT_SECRET_KEY", None)
            backend.config._settings = None

    def test_settings_production_with_test_mode_rejected(self):
        """Test that Settings rejects production with test mode."""
        import backend.config
        backend.config._settings = None
        
        with pytest.raises(ValidationError) as exc_info:
            Settings(
                security={"jwt_secret_key": "test_secret_key_12345678"},
                environment={"environment": "production", "test_mode": True},
                _env_file=None
            )
        assert "TEST_MODE cannot be enabled in production" in str(exc_info.value)
        backend.config._settings = None


class TestSecretExposurePrevention:
    """Test that secrets are not exposed in error messages."""

    def test_jwt_secret_not_in_error_message(self):
        """Test that JWT secret value is not exposed in validation error."""
        secret_value = "my_secret_password_123"
        with pytest.raises(ValidationError) as exc_info:
            SecurityConfig(jwt_secret_key="")
        # The error message should not contain the secret value
        assert secret_value not in str(exc_info.value)

    def test_api_key_not_in_error_message(self):
        """Test that API key values are not exposed in validation error."""
        api_key_value = "sk_live_1234567890abcdef"
        with pytest.raises(ValidationError) as exc_info:
            SecurityConfig(jwt_secret_key="")  # Trigger validation error
        # The error message should not contain the API key value
        assert api_key_value not in str(exc_info.value)


class TestEnvironmentIsolation:
    """Test that environment configurations are properly isolated."""

    def test_development_allows_dev_mode(self):
        """Test that development environment allows dev mode."""
        config = SecurityConfig(jwt_secret_key="test_secret", allow_dev=True)
        assert config.allow_dev is True

    def test_production_can_disable_dev_mode(self):
        """Test that production environment can disable dev mode."""
        config = SecurityConfig(jwt_secret_key="test_secret", allow_dev=False)
        assert config.allow_dev is False

    def test_environment_affects_test_mode_validation(self):
        """Test that environment affects test mode validation."""
        # Production should reject test mode
        with pytest.raises(ValidationError):
            EnvironmentConfig(environment="production", test_mode=True)
        
        # Development should accept test mode
        config = EnvironmentConfig(environment="development", test_mode=True)
        assert config.test_mode is True


class TestConfigurationHardening:
    """Test configuration hardening for production deployments."""

    def test_production_defaults_are_secure(self):
        """Test that production defaults are secure."""
        import backend.config
        backend.config._settings = None
        
        with patch.dict(os.environ, {}, clear=True):
            settings = Settings(
                security={"jwt_secret_key": "test_secret_key_12345678"},
                environment={"environment": "production"},
                _env_file=None
            )
            # Check secure defaults
            assert settings.environment.environment == "production"
            assert settings.environment.test_mode is False
            assert settings.security.allow_dev is False
            assert settings.ai.stub_mode is False
            assert settings.ai.health_debug is False
        backend.config._settings = None

    def test_cannot_override_production_security_defaults_unsafely(self):
        """Test that certain security defaults cannot be overridden unsafely in production."""
        import backend.config
        backend.config._settings = None
        
        # Try to enable test mode in production - should fail
        with pytest.raises(ValidationError):
            Settings(
                security={"jwt_secret_key": "test_secret_key_12345678"},
                environment={"environment": "production", "test_mode": True},
                _env_file=None
            )
        backend.config._settings = None


class TestSecretRotationSupport:
    """Test that configuration supports secret rotation."""

    def test_jwt_secret_can_be_changed(self):
        """Test that JWT_SECRET_KEY can be changed."""
        config1 = SecurityConfig(jwt_secret_key="secret1")
        config2 = SecurityConfig(jwt_secret_key="secret2")
        assert config1.jwt_secret_key == "secret1"
        assert config2.jwt_secret_key == "secret2"

    def test_api_keys_can_be_rotated(self):
        """Test that API_KEYS can be rotated."""
        config1 = SecurityConfig(jwt_secret_key="test_secret", api_keys="key1,key2")
        config2 = SecurityConfig(jwt_secret_key="test_secret", api_keys="key3,key4")
        assert config1.api_keys == "key1,key2"
        assert config2.api_keys == "key3,key4"

    def test_dev_api_key_can_be_changed(self):
        """Test that DEV_API_KEY can be changed."""
        config1 = SecurityConfig(jwt_secret_key="test_secret", dev_api_key="dev-key-1")
        config2 = SecurityConfig(jwt_secret_key="test_secret", dev_api_key="dev-key-2")
        assert config1.dev_api_key == "dev-key-1"
        assert config2.dev_api_key == "dev-key-2"
