"""
Centralized Configuration Management

This module provides a single source of truth for all environment configuration
with comprehensive validation, type safety, and clear error messages.

All environment variables are validated at startup using Pydantic Settings,
ensuring invalid configurations fail fast with descriptive error messages.
"""

import os
from typing import Literal, Optional
from pydantic import (
    Field,
    field_validator,
    model_validator,
    ValidationError,
    ConfigDict,
)
from pydantic_settings import BaseSettings
import logging

logger = logging.getLogger(__name__)


class DatabaseConfig(BaseSettings):
    """Database configuration settings."""
    
    model_config = ConfigDict(env_prefix="", case_sensitive=False)
    
    database_url: Optional[str] = Field(
        default=None,
        description="Database connection URL. Falls back to SQLite if not provided."
    )
    vercel: Optional[str] = Field(
        default=None,
        description="Vercel environment indicator."
    )
    redis_url: Optional[str] = Field(
        default=None,
        description="Redis URL for distributed rate limiting."
    )


class SecurityConfig(BaseSettings):
    """Security and authentication configuration."""
    
    model_config = ConfigDict(env_prefix="", case_sensitive=False)
    
    jwt_secret_key: str = Field(
        ...,
        description="JWT secret key for token signing. Required in all environments."
    )
    api_keys: str = Field(
        default="",
        description="Comma-separated list of valid API keys."
    )
    allow_dev: bool = Field(
        default=False,
        description="Allow development mode API keys."
    )
    dev_api_key: str = Field(
        default="dev-token",
        description="Development mode API key."
    )
    
    @field_validator('jwt_secret_key')
    @classmethod
    def validate_jwt_secret_key(cls, v: str) -> str:
        """Validate JWT secret key is not empty and has reasonable length."""
        if not v or not v.strip():
            raise ValueError('JWT_SECRET_KEY cannot be empty')
        if len(v) < 16:
            logger.warning(
                "JWT_SECRET_KEY is shorter than recommended 16 characters. "
                "Consider using a stronger secret."
            )
        return v


class EnvironmentConfig(BaseSettings):
    """Environment and deployment configuration."""
    
    model_config = ConfigDict(env_prefix="", case_sensitive=False)
    
    environment: Literal["development", "testing", "staging", "production"] = Field(
        default="production",
        description="Application environment."
    )
    test_mode: bool = Field(
        default=False,
        description="Enable test mode for controlled failure simulation."
    )
    
    @model_validator(mode='after')
    def validate_test_mode_environment(self):
        """Ensure test_mode is only enabled in non-production environments."""
        if self.environment == "production" and self.test_mode:
            raise ValueError(
                "TEST_MODE cannot be enabled in production environment. "
                "Set ENVIRONMENT to development, testing, or staging to enable test mode."
            )
        return self


class FileUploadConfig(BaseSettings):
    """File upload and processing configuration."""
    
    model_config = ConfigDict(env_prefix="", case_sensitive=False)
    
    max_upload_size: int = Field(
        default=25 * 1024 * 1024,
        description="Maximum file upload size in bytes."
    )
    max_pdf_pages: int = Field(
        default=100,
        description="Maximum number of PDF pages to process."
    )
    max_docx_paragraphs: int = Field(
        default=2000,
        description="Maximum number of DOCX paragraphs to process."
    )
    max_extracted_text_chars: int = Field(
        default=10000,
        description="Maximum characters of text to extract from documents."
    )
    upload_parse_timeout_seconds: float = Field(
        default=5.0,
        description="Timeout in seconds for document parsing."
    )
    token_cleanup_interval_seconds: int = Field(
        default=3600,
        description="Interval in seconds for token cleanup task."
    )
    
    @field_validator('max_upload_size')
    @classmethod
    def validate_max_upload_size(cls, v: int) -> int:
        """Validate max upload size is positive and reasonable."""
        if v <= 0:
            raise ValueError('MAX_UPLOAD_SIZE must be greater than 0')
        if v > 1024 * 1024 * 1024:  # 1GB
            logger.warning(
                f"MAX_UPLOAD_SIZE ({v} bytes) is very large. "
                "Consider setting a lower limit to prevent memory issues."
            )
        return v
    
    @field_validator('max_pdf_pages')
    @classmethod
    def validate_max_pdf_pages(cls, v: int) -> int:
        """Validate max PDF pages is positive and reasonable."""
        if v <= 0:
            raise ValueError('MAX_PDF_PAGES must be greater than 0')
        if v > 1000:
            logger.warning(
                f"MAX_PDF_PAGES ({v}) is very large. "
                "Consider setting a lower limit to prevent processing timeouts."
            )
        return v
    
    @field_validator('max_docx_paragraphs')
    @classmethod
    def validate_max_docx_paragraphs(cls, v: int) -> int:
        """Validate max DOCX paragraphs is positive."""
        if v <= 0:
            raise ValueError('MAX_DOCX_PARAGRAPHS must be greater than 0')
        return v
    
    @field_validator('max_extracted_text_chars')
    @classmethod
    def validate_max_extracted_text_chars(cls, v: int) -> int:
        """Validate max extracted text chars is positive."""
        if v <= 0:
            raise ValueError('MAX_EXTRACTED_TEXT_CHARS must be greater than 0')
        return v
    
    @field_validator('upload_parse_timeout_seconds')
    @classmethod
    def validate_upload_parse_timeout_seconds(cls, v: float) -> float:
        """Validate upload parse timeout is positive and reasonable."""
        if v <= 0:
            raise ValueError('UPLOAD_PARSE_TIMEOUT_SECONDS must be greater than 0')
        if v > 300:  # 5 minutes
            logger.warning(
                f"UPLOAD_PARSE_TIMEOUT_SECONDS ({v}s) is very large. "
                "Consider setting a lower limit to prevent hanging requests."
            )
        return v
    
    @field_validator('token_cleanup_interval_seconds')
    @classmethod
    def validate_token_cleanup_interval_seconds(cls, v: int) -> int:
        """Validate token cleanup interval is positive."""
        if v <= 0:
            raise ValueError('TOKEN_CLEANUP_INTERVAL_SECONDS must be greater than 0')
        return v


class InputValidationConfig(BaseSettings):
    """Input validation limits configuration."""
    
    model_config = ConfigDict(env_prefix="", case_sensitive=False)
    
    max_chat_input_chars: int = Field(
        default=4000,
        description="Maximum characters for chat input."
    )
    max_summarize_input_chars: int = Field(
        default=20000,
        description="Maximum characters for summarization input."
    )
    max_simplify_input_chars: int = Field(
        default=10000,
        description="Maximum characters for simplification input."
    )
    max_context_input_chars: int = Field(
        default=10000,
        description="Maximum characters for document context input."
    )
    max_docx_archive_entries: int = Field(
        default=200,
        description="Maximum number of entries in DOCX archive."
    )
    max_docx_archive_uncompressed_bytes: int = Field(
        default=10 * 1024 * 1024,
        description="Maximum uncompressed bytes for DOCX archive."
    )
    max_docx_archive_entry_bytes: int = Field(
        default=5 * 1024 * 1024,
        description="Maximum bytes for single DOCX archive entry."
    )
    max_docx_archive_ratio: float = Field(
        default=100.0,
        description="Maximum compression ratio for DOCX archive."
    )
    max_docx_xml_bytes: int = Field(
        default=5 * 1024 * 1024,
        description="Maximum bytes for DOCX XML content."
    )
    
    @field_validator('max_chat_input_chars', 'max_summarize_input_chars', 
                   'max_simplify_input_chars', 'max_context_input_chars')
    @classmethod
    def validate_max_input_chars(cls, v: int) -> int:
        """Validate max input chars is positive."""
        if v <= 0:
            raise ValueError('Input character limits must be greater than 0')
        return v
    
    @field_validator('max_docx_archive_entries')
    @classmethod
    def validate_max_docx_archive_entries(cls, v: int) -> int:
        """Validate max DOCX archive entries is positive."""
        if v <= 0:
            raise ValueError('MAX_DOCX_ARCHIVE_ENTRIES must be greater than 0')
        return v
    
    @field_validator('max_docx_archive_uncompressed_bytes', 'max_docx_archive_entry_bytes',
                   'max_docx_xml_bytes')
    @classmethod
    def validate_max_bytes(cls, v: int) -> int:
        """Validate max bytes values are positive."""
        if v <= 0:
            raise ValueError('Byte limits must be greater than 0')
        return v
    
    @field_validator('max_docx_archive_ratio')
    @classmethod
    def validate_max_docx_archive_ratio(cls, v: float) -> float:
        """Validate max DOCX archive ratio is positive."""
        if v <= 0:
            raise ValueError('MAX_DOCX_ARCHIVE_RATIO must be greater than 0')
        return v


class RateLimitConfig(BaseSettings):
    """Rate limiting configuration."""
    
    model_config = ConfigDict(env_prefix="", case_sensitive=False)
    
    rate_limit_period: int = Field(
        default=60,
        description="Rate limit period in seconds."
    )
    rate_limit_key_calls: int = Field(
        default=300,
        description="Rate limit calls per period for API keys."
    )
    rate_limit_ip_calls: int = Field(
        default=60,
        description="Rate limit calls per period for IP addresses."
    )
    trust_proxy_headers: bool = Field(
        default=False,
        description="Trust X-Forwarded-* headers for client IP detection."
    )
    
    # Authentication rate limits
    auth_login_rate_limit: int = Field(
        default=5,
        description="Rate limit for login attempts."
    )
    auth_login_rate_period: int = Field(
        default=60,
        description="Rate limit period for login attempts in seconds."
    )
    auth_login_failed_attempt_limit: int = Field(
        default=10,
        description="Failed login attempt limit."
    )
    auth_login_failed_attempt_period: int = Field(
        default=300,
        description="Failed login attempt period in seconds."
    )
    auth_login_lockout_duration: int = Field(
        default=900,
        description="Lockout duration after failed attempts in seconds."
    )
    auth_signup_rate_limit: int = Field(
        default=3,
        description="Rate limit for signup attempts."
    )
    auth_signup_rate_period: int = Field(
        default=3600,
        description="Rate limit period for signup attempts in seconds."
    )
    auth_verification_rate_limit: int = Field(
        default=3,
        description="Rate limit for verification requests."
    )
    auth_verification_rate_period: int = Field(
        default=3600,
        description="Rate limit period for verification requests in seconds."
    )
    
    # Comparison rate limits
    compare_rate_limit_calls: int = Field(
        default=60,
        description="Rate limit calls for comparison requests."
    )
    compare_rate_limit_period: int = Field(
        default=60,
        description="Rate limit period for comparison requests in seconds."
    )
    
    @field_validator('rate_limit_period', 'auth_login_rate_period', 
                   'auth_login_failed_attempt_period', 'auth_login_lockout_duration',
                   'auth_signup_rate_period', 'auth_verification_rate_period',
                   'compare_rate_limit_period')
    @classmethod
    def validate_rate_limit_periods(cls, v: int) -> int:
        """Validate rate limit periods are positive."""
        if v <= 0:
            raise ValueError('Rate limit periods must be greater than 0')
        return v
    
    @field_validator('rate_limit_key_calls', 'rate_limit_ip_calls',
                   'auth_login_rate_limit', 'auth_login_failed_attempt_limit',
                   'auth_signup_rate_limit', 'auth_verification_rate_limit',
                   'compare_rate_limit_calls')
    @classmethod
    def validate_rate_limit_calls(cls, v: int) -> int:
        """Validate rate limit call counts are positive."""
        if v <= 0:
            raise ValueError('Rate limit call counts must be greater than 0')
        return v


class AIConfig(BaseSettings):
    """AI service configuration."""
    
    model_config = ConfigDict(env_prefix="", case_sensitive=False)
    
    bytez_api_key: Optional[str] = Field(
        default=None,
        description="API key for Bytez AI service."
    )
    chat_model: str = Field(
        default="inference-net/Schematron-3B",
        description="Model name for chat requests."
    )
    summarize_model: str = Field(
        default="inference-net/Schematron-3B",
        description="Model name for summarization requests."
    )
    max_model_input_chars: int = Field(
        default=15000,
        description="Maximum characters for model input."
    )
    provider_timeout: float = Field(
        default=30.0,
        description="Timeout in seconds for AI provider requests."
    )
    provider_retries: int = Field(
        default=3,
        description="Number of retries for AI provider requests."
    )
    retry_backoff_factor: float = Field(
        default=2.0,
        description="Backoff factor for retry attempts."
    )
    graceful_degradation: bool = Field(
        default=True,
        description="Enable graceful degradation when AI service is unavailable."
    )
    stub_mode: bool = Field(
        default=False,
        description="Enable stub mode for testing without AI service."
    )
    health_debug: bool = Field(
        default=False,
        description="Enable debug information in health endpoint."
    )
    
    @field_validator('max_model_input_chars')
    @classmethod
    def validate_max_model_input_chars(cls, v: int) -> int:
        """Validate max model input chars is positive."""
        if v <= 0:
            raise ValueError('MAX_MODEL_INPUT_CHARS must be greater than 0')
        return v
    
    @field_validator('provider_timeout')
    @classmethod
    def validate_provider_timeout(cls, v: float) -> float:
        """Validate provider timeout is positive and reasonable."""
        if v <= 0:
            raise ValueError('PROVIDER_TIMEOUT must be greater than 0')
        if v > 600:  # 10 minutes
            logger.warning(
                f"PROVIDER_TIMEOUT ({v}s) is very large. "
                "Consider setting a lower limit to prevent hanging requests."
            )
        return v
    
    @field_validator('provider_retries')
    @classmethod
    def validate_provider_retries(cls, v: int) -> int:
        """Validate provider retries is positive and reasonable."""
        if v <= 0:
            raise ValueError('PROVIDER_RETRIES must be greater than 0')
        if v > 10:
            logger.warning(
                f"PROVIDER_RETRIES ({v}) is very large. "
                "Consider setting a lower limit to prevent excessive retries."
            )
        return v
    
    @field_validator('retry_backoff_factor')
    @classmethod
    def validate_retry_backoff_factor(cls, v: float) -> float:
        """Validate retry backoff factor is positive."""
        if v <= 0:
            raise ValueError('RETRY_BACKOFF_FACTOR must be greater than 0')
        return v
    
    @model_validator(mode='after')
    def validate_ai_config_environment(self):
        """Ensure AI configuration is appropriate for environment."""
        environment = os.getenv("ENVIRONMENT", "production")
        bytez_api_key = self.bytez_api_key
        stub_mode = self.stub_mode
        
        if environment == "production" and not bytez_api_key and not stub_mode:
            logger.warning(
                "BYTEZ_API_KEY is not set in production environment. "
                "AI features will be unavailable or run in degraded mode."
            )
        
        return self


class ComparisonConfig(BaseSettings):
    """Document comparison configuration."""
    
    model_config = ConfigDict(env_prefix="", case_sensitive=False)
    
    compare_max_context_chars: int = Field(
        default=14000,
        description="Maximum characters for comparison context."
    )
    compare_max_documents: int = Field(
        default=10,
        description="Maximum number of documents for comparison."
    )
    
    @field_validator('compare_max_context_chars')
    @classmethod
    def validate_compare_max_context_chars(cls, v: int) -> int:
        """Validate comparison max context chars is positive."""
        if v <= 0:
            raise ValueError('COMPARE_MAX_CONTEXT_CHARS must be greater than 0')
        return v
    
    @field_validator('compare_max_documents')
    @classmethod
    def validate_compare_max_documents(cls, v: int) -> int:
        """Validate comparison max documents is positive and reasonable."""
        if v < 2:
            raise ValueError('COMPARE_MAX_DOCUMENTS must be at least 2')
        if v > 50:
            logger.warning(
                f"COMPARE_MAX_DOCUMENTS ({v}) is very large. "
                "Consider setting a lower limit to prevent processing timeouts."
            )
        return v


class CORSConfig(BaseSettings):
    """CORS configuration."""
    
    model_config = ConfigDict(env_prefix="", case_sensitive=False)
    
    allowed_origins: str = Field(
        default="http://localhost:5173",
        description="Comma-separated list of allowed CORS origins."
    )
    frontend_url: str = Field(
        default="http://localhost:5173",
        description="Frontend URL for CORS (fallback for allowed_origins)."
    )


class Settings(BaseSettings):
    """
    Main application settings class that aggregates all configuration sections.
    
    This is the single source of truth for all environment configuration.
    All validation happens at initialization, ensuring invalid configurations
    fail fast with clear error messages.
    """
    
    model_config = ConfigDict(env_prefix="", case_sensitive=False)
    
    database: DatabaseConfig = Field(default_factory=DatabaseConfig)
    security: SecurityConfig = Field(default_factory=SecurityConfig)
    environment: EnvironmentConfig = Field(default_factory=EnvironmentConfig)
    file_upload: FileUploadConfig = Field(default_factory=FileUploadConfig)
    input_validation: InputValidationConfig = Field(default_factory=InputValidationConfig)
    rate_limit: RateLimitConfig = Field(default_factory=RateLimitConfig)
    ai: AIConfig = Field(default_factory=AIConfig)
    comparison: ComparisonConfig = Field(default_factory=ComparisonConfig)
    cors: CORSConfig = Field(default_factory=CORSConfig)


# Global settings instance
_settings: Optional[Settings] = None


def get_settings() -> Settings:
    """
    Get the global settings instance.
    
    Initializes settings on first call and validates all configuration.
    Raises ValidationError if configuration is invalid.
    
    Returns:
        Settings: The validated settings instance.
    
    Raises:
        ValidationError: If configuration is invalid.
    """
    global _settings
    
    if _settings is None:
        try:
            _settings = Settings()
            logger.info("Configuration loaded and validated successfully")
        except ValidationError as e:
            logger.error(f"Configuration validation failed: {e}")
            raise
    
    return _settings


def validate_config() -> None:
    """
    Validate configuration without initializing the global settings instance.
    
    This is useful for testing configuration without side effects.
    
    Raises:
        ValidationError: If configuration is invalid.
    """
    try:
        Settings()
        logger.info("Configuration validation passed")
    except ValidationError as e:
        logger.error(f"Configuration validation failed: {e}")
        raise


# Convenience functions for backward compatibility
def get_database_url() -> Optional[str]:
    """Get database URL from settings."""
    return get_settings().database.database_url


def get_jwt_secret_key() -> str:
    """Get JWT secret key from settings."""
    return get_settings().security.jwt_secret_key


def is_production() -> bool:
    """Check if running in production environment."""
    return get_settings().environment.environment == "production"


def is_development() -> bool:
    """Check if running in development environment."""
    return get_settings().environment.environment == "development"


def is_test_mode() -> bool:
    """Check if test mode is enabled."""
    return get_settings().environment.test_mode
