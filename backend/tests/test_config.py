"""
Configuration Validation Tests

This test suite validates the centralized configuration system,
ensuring all environment variables are properly validated at startup.
"""

import os
import pytest
from pydantic import ValidationError

from backend.config import (
    Settings,
    DatabaseConfig,
    SecurityConfig,
    EnvironmentConfig,
    FileUploadConfig,
    InputValidationConfig,
    RateLimitConfig,
    AIConfig,
    ComparisonConfig,
    CORSConfig,
    EncryptionConfig,
    get_settings,
    validate_config,
)


class TestDatabaseConfig:
    """Test database configuration validation."""

    def test_database_url_optional(self):
        """Test that DATABASE_URL is optional and falls back to SQLite."""
        # Clear any existing DATABASE_URL environment variable
        import os
        os.environ.pop("DATABASE_URL", None)
        config = DatabaseConfig(_env_file=None)
        # Pydantic-settings may set a default, so we check it's a valid SQLite URL
        assert config.database_url is None or config.database_url.startswith("sqlite://")

    def test_database_url_provided(self):
        """Test that DATABASE_URL can be provided."""
        config = DatabaseConfig(database_url="postgresql://user:pass@localhost/db")
        assert config.database_url == "postgresql://user:pass@localhost/db"

    def test_vercel_optional(self):
        """Test that VERCEL is optional."""
        config = DatabaseConfig()
        assert config.vercel is None

    def test_redis_url_optional(self):
        """Test that REDIS_URL is optional."""
        config = DatabaseConfig()
        assert config.redis_url is None


class TestSecurityConfig:
    """Test security configuration validation."""

    def test_jwt_secret_key_required(self):
        """Test that JWT_SECRET_KEY is required."""
        with pytest.raises(ValidationError) as exc_info:
            SecurityConfig(jwt_secret_key="")
        assert "JWT_SECRET_KEY" in str(exc_info.value)

    def test_jwt_secret_key_short_warning(self, caplog):
        """Test that short JWT secret key generates warning."""
        with caplog.at_level("WARNING"):
            config = SecurityConfig(jwt_secret_key="short")
        assert config.jwt_secret_key == "short"
        assert "shorter than recommended" in caplog.text

    def test_jwt_secret_key_valid(self):
        """Test that valid JWT secret key is accepted."""
        config = SecurityConfig(jwt_secret_key="a" * 32)
        assert config.jwt_secret_key == "a" * 32

    def test_api_keys_default_empty(self):
        """Test that API_KEYS defaults to empty string."""
        config = SecurityConfig(jwt_secret_key="test_secret")
        assert config.api_keys == ""

    def test_allow_dev_default_false(self):
        """Test that ALLOW_DEV defaults to False."""
        import os
        os.environ.pop("ALLOW_DEV", None)
        config = SecurityConfig(jwt_secret_key="test_secret", _env_file=None)
        assert config.allow_dev is False

    def test_dev_api_key_default(self):
        """Test that DEV_API_KEY has default value."""
        config = SecurityConfig(jwt_secret_key="test_secret")
        assert config.dev_api_key == "dev-token"


class TestEnvironmentConfig:
    """Test environment configuration validation."""

    def test_environment_default_production(self):
        """Test that ENVIRONMENT defaults to production."""
        old_env = os.environ.pop("ENVIRONMENT", None)
        try:
            config = EnvironmentConfig()
            assert config.environment == "production"
        finally:
            if old_env is not None:
                os.environ["ENVIRONMENT"] = old_env

    def test_environment_valid_values(self):
        """Test that valid environment values are accepted."""
        for env in ["development", "testing", "staging", "production"]:
            config = EnvironmentConfig(environment=env)
            assert config.environment == env

    def test_environment_invalid_value(self):
        """Test that invalid environment value is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            EnvironmentConfig(environment="invalid")
        assert "environment" in str(exc_info.value)

    def test_test_mode_default_false(self):
        """Test that TEST_MODE defaults to False."""
        config = EnvironmentConfig()
        assert config.test_mode is False

    def test_test_mode_in_development(self):
        """Test that TEST_MODE can be enabled in development."""
        config = EnvironmentConfig(environment="development", test_mode=True)
        assert config.test_mode is True

    def test_test_mode_rejected_in_production(self):
        """Test that TEST_MODE is rejected in production."""
        with pytest.raises(ValidationError) as exc_info:
            EnvironmentConfig(environment="production", test_mode=True)
        assert "TEST_MODE cannot be enabled in production" in str(exc_info.value)


class TestFileUploadConfig:
    """Test file upload configuration validation."""

    def test_max_upload_size_default(self):
        """Test that MAX_UPLOAD_SIZE has default value."""
        config = FileUploadConfig()
        assert config.max_upload_size == 25 * 1024 * 1024

    def test_max_upload_size_negative_rejected(self):
        """Test that negative MAX_UPLOAD_SIZE is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            FileUploadConfig(max_upload_size=-1)
        assert "MAX_UPLOAD_SIZE must be greater than 0" in str(exc_info.value)

    def test_max_upload_size_zero_rejected(self):
        """Test that zero MAX_UPLOAD_SIZE is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            FileUploadConfig(max_upload_size=0)
        assert "MAX_UPLOAD_SIZE must be greater than 0" in str(exc_info.value)

    def test_max_pdf_pages_default(self):
        """Test that MAX_PDF_PAGES has default value."""
        config = FileUploadConfig()
        assert config.max_pdf_pages == 100

    def test_max_pdf_pages_negative_rejected(self):
        """Test that negative MAX_PDF_PAGES is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            FileUploadConfig(max_pdf_pages=-1)
        assert "MAX_PDF_PAGES must be greater than 0" in str(exc_info.value)

    def test_upload_parse_timeout_default(self):
        """Test that UPLOAD_PARSE_TIMEOUT_SECONDS has default value."""
        config = FileUploadConfig()
        assert config.upload_parse_timeout_seconds == 5.0

    def test_upload_parse_timeout_negative_rejected(self):
        """Test that negative timeout is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            FileUploadConfig(upload_parse_timeout_seconds=-1.0)
        assert "UPLOAD_PARSE_TIMEOUT_SECONDS must be greater than 0" in str(exc_info.value)

    def test_token_cleanup_interval_default(self):
        """Test that TOKEN_CLEANUP_INTERVAL_SECONDS has default value."""
        config = FileUploadConfig()
        assert config.token_cleanup_interval_seconds == 3600

    def test_token_cleanup_interval_negative_rejected(self):
        """Test that negative cleanup interval is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            FileUploadConfig(token_cleanup_interval_seconds=-1)
        assert "TOKEN_CLEANUP_INTERVAL_SECONDS must be greater than 0" in str(exc_info.value)


class TestInputValidationConfig:
    """Test input validation configuration validation."""

    def test_max_chat_input_chars_default(self):
        """Test that MAX_CHAT_INPUT_CHARS has default value."""
        config = InputValidationConfig()
        assert config.max_chat_input_chars == 4000

    def test_max_chat_input_chars_negative_rejected(self):
        """Test that negative MAX_CHAT_INPUT_CHARS is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            InputValidationConfig(max_chat_input_chars=-1)
        assert "Input character limits must be greater than 0" in str(exc_info.value)

    def test_max_docx_archive_ratio_default(self):
        """Test that MAX_DOCX_ARCHIVE_RATIO has default value."""
        config = InputValidationConfig()
        assert config.max_docx_archive_ratio == 100.0

    def test_max_docx_archive_ratio_negative_rejected(self):
        """Test that negative MAX_DOCX_ARCHIVE_RATIO is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            InputValidationConfig(max_docx_archive_ratio=-1.0)
        assert "MAX_DOCX_ARCHIVE_RATIO must be greater than 0" in str(exc_info.value)


class TestRateLimitConfig:
    """Test rate limiting configuration validation."""

    def test_rate_limit_period_default(self):
        """Test that RATE_LIMIT_PERIOD has default value."""
        config = RateLimitConfig()
        assert config.rate_limit_period == 60

    def test_rate_limit_period_negative_rejected(self):
        """Test that negative RATE_LIMIT_PERIOD is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            RateLimitConfig(rate_limit_period=-1)
        assert "Rate limit periods must be greater than 0" in str(exc_info.value)

    def test_rate_limit_key_calls_default(self):
        """Test that RATE_LIMIT_KEY_CALLS has default value."""
        config = RateLimitConfig()
        assert config.rate_limit_key_calls == 300

    def test_rate_limit_key_calls_negative_rejected(self):
        """Test that negative RATE_LIMIT_KEY_CALLS is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            RateLimitConfig(rate_limit_key_calls=-1)
        assert "Rate limit call counts must be greater than 0" in str(exc_info.value)

    def test_auth_login_rate_limit_default(self):
        """Test that AUTH_LOGIN_RATE_LIMIT has default value."""
        config = RateLimitConfig()
        assert config.auth_login_rate_limit == 5

    def test_auth_login_rate_limit_negative_rejected(self):
        """Test that negative AUTH_LOGIN_RATE_LIMIT is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            RateLimitConfig(auth_login_rate_limit=-1)
        assert "Rate limit call counts must be greater than 0" in str(exc_info.value)


class TestAIConfig:
    """Test AI service configuration validation."""

    def test_bytez_api_key_optional(self):
        """Test that BYTEZ_API_KEY is optional."""
        import os
        old_key = os.environ.pop("BYTEZ_API_KEY", None)
        try:
            config = AIConfig()
            assert config.bytez_api_key is None
        finally:
            if old_key is not None:
                os.environ["BYTEZ_API_KEY"] = old_key

    def test_chat_model_default(self):
        """Test that CHAT_MODEL has default value."""
        config = AIConfig()
        assert config.chat_model == "inference-net/Schematron-3B"

    def test_max_model_input_chars_default(self):
        """Test that MAX_MODEL_INPUT_CHARS has default value."""
        config = AIConfig()
        assert config.max_model_input_chars == 15000

    def test_max_model_input_chars_negative_rejected(self):
        """Test that negative MAX_MODEL_INPUT_CHARS is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            AIConfig(max_model_input_chars=-1)
        assert "MAX_MODEL_INPUT_CHARS must be greater than 0" in str(exc_info.value)

    def test_provider_timeout_default(self):
        """Test that PROVIDER_TIMEOUT has default value."""
        config = AIConfig()
        assert config.provider_timeout == 30.0

    def test_provider_timeout_negative_rejected(self):
        """Test that negative PROVIDER_TIMEOUT is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            AIConfig(provider_timeout=-1.0)
        assert "PROVIDER_TIMEOUT must be greater than 0" in str(exc_info.value)

    def test_provider_retries_default(self):
        """Test that PROVIDER_RETRIES has default value."""
        config = AIConfig()
        assert config.provider_retries == 3

    def test_provider_retries_negative_rejected(self):
        """Test that negative PROVIDER_RETRIES is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            AIConfig(provider_retries=-1)
        assert "PROVIDER_RETRIES must be greater than 0" in str(exc_info.value)

    def test_graceful_degradation_default_true(self):
        """Test that GRACEFUL_DEGRADATION defaults to True."""
        config = AIConfig()
        assert config.graceful_degradation is True

    def test_stub_mode_default_false(self):
        """Test that STUB_MODE defaults to False."""
        import os
        os.environ.pop("STUB_MODE", None)
        config = AIConfig(_env_file=None)
        assert config.stub_mode is False


class TestComparisonConfig:
    """Test comparison configuration validation."""

    def test_compare_max_context_chars_default(self):
        """Test that COMPARE_MAX_CONTEXT_CHARS has default value."""
        config = ComparisonConfig()
        assert config.compare_max_context_chars == 14000

    def test_compare_max_context_chars_negative_rejected(self):
        """Test that negative COMPARE_MAX_CONTEXT_CHARS is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            ComparisonConfig(compare_max_context_chars=-1)
        assert "COMPARE_MAX_CONTEXT_CHARS must be greater than 0" in str(exc_info.value)

    def test_compare_max_documents_default(self):
        """Test that COMPARE_MAX_DOCUMENTS has default value."""
        config = ComparisonConfig()
        assert config.compare_max_documents == 10

    def test_compare_max_documents_less_than_two_rejected(self):
        """Test that COMPARE_MAX_DOCUMENTS less than 2 is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            ComparisonConfig(compare_max_documents=1)
        assert "COMPARE_MAX_DOCUMENTS must be at least 2" in str(exc_info.value)

    def test_compare_max_documents_negative_rejected(self):
        """Test that negative COMPARE_MAX_DOCUMENTS is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            ComparisonConfig(compare_max_documents=-1)
        assert "COMPARE_MAX_DOCUMENTS must be at least 2" in str(exc_info.value)


class TestCORSConfig:
    """Test CORS configuration validation."""

    def test_allowed_origins_default(self):
        """Test that ALLOWED_ORIGINS has default value."""
        config = CORSConfig()
        assert config.allowed_origins == "http://localhost:5173"

    def test_frontend_url_default(self):
        """Test that FRONTEND_URL has default value."""
        config = CORSConfig()
        assert config.frontend_url == "http://localhost:5173"


class TestEncryptionConfig:
    """Test encryption configuration validation."""

    def test_document_encryption_key_optional(self):
        """Test that DOCUMENT_ENCRYPTION_KEY is optional."""
        config = EncryptionConfig()
        assert config.document_encryption_key is None

    def test_document_encryption_key_can_be_set(self):
        """Test that DOCUMENT_ENCRYPTION_KEY can be set."""
        config = EncryptionConfig(document_encryption_key="test-encryption-key")
        assert config.document_encryption_key == "test-encryption-key"

    def test_production_requires_document_encryption_key(self, monkeypatch):
        """Test that production requires DOCUMENT_ENCRYPTION_KEY."""
        monkeypatch.setenv("ENVIRONMENT", "production")
        monkeypatch.setenv("JWT_SECRET_KEY", "test_secret")
        try:
            with pytest.raises(ValidationError) as exc_info:
                EncryptionConfig(_env_file=None)
            assert "DOCUMENT_ENCRYPTION_KEY is required in production" in str(exc_info.value)
        finally:
            monkeypatch.delenv("ENVIRONMENT", raising=False)
            monkeypatch.delenv("JWT_SECRET_KEY", raising=False)

    def test_non_production_allows_missing_document_encryption_key(self, monkeypatch):
        """Test that non-production environments allow missing DOCUMENT_ENCRYPTION_KEY."""
        monkeypatch.setenv("ENVIRONMENT", "development")
        monkeypatch.setenv("JWT_SECRET_KEY", "test_secret")
        try:
            config = EncryptionConfig(_env_file=None)
            assert config.document_encryption_key is None
        finally:
            monkeypatch.delenv("ENVIRONMENT", raising=False)
            monkeypatch.delenv("JWT_SECRET_KEY", raising=False)

    def test_production_with_document_encryption_key_succeeds(self, monkeypatch):
        """Test that production with DOCUMENT_ENCRYPTION_KEY succeeds."""
        monkeypatch.setenv("ENVIRONMENT", "production")
        monkeypatch.setenv("JWT_SECRET_KEY", "test_secret")
        monkeypatch.setenv("DOCUMENT_ENCRYPTION_KEY", "production-key")
        try:
            config = EncryptionConfig(_env_file=None)
            assert config.document_encryption_key == "production-key"
        finally:
            monkeypatch.delenv("ENVIRONMENT", raising=False)
            monkeypatch.delenv("JWT_SECRET_KEY", raising=False)
            monkeypatch.delenv("DOCUMENT_ENCRYPTION_KEY", raising=False)


class TestSettingsIntegration:
    """Test integrated settings validation."""

    def test_settings_initialization_with_defaults(self):
        """Test that Settings can be initialized with all defaults except required."""
        # Set required environment variable
        os.environ["JWT_SECRET_KEY"] = "test_secret_key_12345678"
        old_env = os.environ.pop("ENVIRONMENT", None)
        try:
            settings = Settings()
            assert settings.security.jwt_secret_key == "test_secret_key_12345678"
            assert settings.environment.environment == "production"
            assert settings.file_upload.max_upload_size == 25 * 1024 * 1024
        finally:
            os.environ.pop("JWT_SECRET_KEY", None)
            if old_env is not None:
                os.environ["ENVIRONMENT"] = old_env

    def test_settings_missing_required_variable(self):
        """Test that Settings fails without required JWT_SECRET_KEY."""
        # Ensure JWT_SECRET_KEY is not set
        os.environ.pop("JWT_SECRET_KEY", None)
        import backend.config
        backend.config._settings = None
        
        with pytest.raises(ValidationError) as exc_info:
            Settings()
        # Pydantic v2 uses lowercase field names in error messages
        assert "jwt_secret_key" in str(exc_info.value).lower()

    def test_validate_config_function(self):
        """Test that validate_config function works correctly."""
        os.environ["JWT_SECRET_KEY"] = "test_secret_key_12345678"
        try:
            validate_config()  # Should not raise
        finally:
            os.environ.pop("JWT_SECRET_KEY", None)

    def test_validate_config_function_with_invalid_config(self):
        """Test that validate_config function raises on invalid config."""
        os.environ["JWT_SECRET_KEY"] = ""
        try:
            with pytest.raises(ValidationError):
                validate_config()
        finally:
            os.environ.pop("JWT_SECRET_KEY", None)


class TestTypeValidation:
    """Test type validation for environment variables."""

    def test_invalid_integer_type_rejected(self):
        """Test that invalid integer values are rejected."""
        os.environ["JWT_SECRET_KEY"] = "test_secret"
        os.environ["MAX_UPLOAD_SIZE"] = "not_a_number"
        try:
            with pytest.raises(ValidationError):
                FileUploadConfig()
        finally:
            os.environ.pop("JWT_SECRET_KEY", None)
            os.environ.pop("MAX_UPLOAD_SIZE", None)

    def test_invalid_float_type_rejected(self):
        """Test that invalid float values are rejected."""
        os.environ["JWT_SECRET_KEY"] = "test_secret"
        os.environ["UPLOAD_PARSE_TIMEOUT_SECONDS"] = "not_a_float"
        try:
            with pytest.raises(ValidationError):
                FileUploadConfig()
        finally:
            os.environ.pop("JWT_SECRET_KEY", None)
            os.environ.pop("UPLOAD_PARSE_TIMEOUT_SECONDS", None)

    def test_invalid_boolean_type_accepted_as_string(self):
        """Test that boolean values are parsed from strings."""
        # Pydantic handles boolean parsing automatically
        # Set environment to development to avoid production validation
        import os
        os.environ.pop("ENVIRONMENT", None)
        config = EnvironmentConfig(environment="development", test_mode="true")
        assert config.test_mode is True


class TestRangeValidation:
    """Test range validation for numeric values."""

    def test_excessively_large_upload_size_warning(self, caplog):
        """Test that excessively large MAX_UPLOAD_SIZE generates warning."""
        with caplog.at_level("WARNING"):
            config = FileUploadConfig(max_upload_size=2 * 1024 * 1024 * 1024)  # 2GB
        assert config.max_upload_size == 2 * 1024 * 1024 * 1024
        assert "very large" in caplog.text

    def test_excessively_large_pdf_pages_warning(self, caplog):
        """Test that excessively large MAX_PDF_PAGES generates warning."""
        with caplog.at_level("WARNING"):
            config = FileUploadConfig(max_pdf_pages=2000)
        assert config.max_pdf_pages == 2000
        assert "very large" in caplog.text

    def test_excessively_large_provider_timeout_warning(self, caplog):
        """Test that excessively large PROVIDER_TIMEOUT generates warning."""
        with caplog.at_level("WARNING"):
            config = AIConfig(provider_timeout=700)
        assert config.provider_timeout == 700
        assert "very large" in caplog.text

    def test_excessively_large_provider_retries_warning(self, caplog):
        """Test that excessively large PROVIDER_RETRIES generates warning."""
        with caplog.at_level("WARNING"):
            config = AIConfig(provider_retries=20)
        assert config.provider_retries == 20
        assert "very large" in caplog.text

    def test_excessively_large_compare_documents_warning(self, caplog):
        """Test that excessively large COMPARE_MAX_DOCUMENTS generates warning."""
        with caplog.at_level("WARNING"):
            config = ComparisonConfig(compare_max_documents=100)
        assert config.compare_max_documents == 100
        assert "very large" in caplog.text


class TestSecurityValidation:
    """Test security-related validation."""

    def test_empty_jwt_secret_rejected(self):
        """Test that empty JWT_SECRET_KEY is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            SecurityConfig(jwt_secret_key="")
        assert "JWT_SECRET_KEY cannot be empty" in str(exc_info.value)

    def test_whitespace_only_jwt_secret_rejected(self):
        """Test that whitespace-only JWT_SECRET_KEY is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            SecurityConfig(jwt_secret_key="   ")
        assert "JWT_SECRET_KEY cannot be empty" in str(exc_info.value)

    def test_production_without_ai_key_warning(self, caplog):
        """Test that production without BYTEZ_API_KEY generates warning."""
        os.environ["ENVIRONMENT"] = "production"
        os.environ["JWT_SECRET_KEY"] = "test_secret"
        with caplog.at_level("WARNING"):
            config = AIConfig(bytez_api_key=None, stub_mode=False)
        assert config.bytez_api_key is None
        assert "BYTEZ_API_KEY is not set in production" in caplog.text
        os.environ.pop("ENVIRONMENT", None)
        os.environ.pop("JWT_SECRET_KEY", None)


class TestGetSettings:
    """Test get_settings singleton function."""

    def test_get_settings_returns_singleton(self):
        """Test that get_settings returns the same instance."""
        os.environ["JWT_SECRET_KEY"] = "test_secret_key_12345678"
        try:
            # Reset the global settings instance
            import backend.config
            backend.config._settings = None
            
            settings1 = get_settings()
            settings2 = get_settings()
            assert settings1 is settings2
        finally:
            os.environ.pop("JWT_SECRET_KEY", None)
            backend.config._settings = None

    def test_get_settings_validates_on_first_call(self):
        """Test that get_settings validates configuration on first call."""
        os.environ.pop("JWT_SECRET_KEY", None)
        import backend.config
        backend.config._settings = None
        
        with pytest.raises(ValidationError):
            get_settings()
