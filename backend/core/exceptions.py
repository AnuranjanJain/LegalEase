class AIError(Exception):
    """Base exception for all AI service errors"""
    pass


class ValidationError(AIError):
    """Raised when request payload fails validation checks"""
    pass


class ProviderError(AIError):
    """Raised when the upstream AI provider (Bytez) fails or returns an error"""
    pass


class TimeoutError(AIError):
    """Raised when the AI model inference times out"""
    pass


class ServiceUnavailableError(AIError):
    """Raised when Bytez is not configured or completely unavailable"""
    pass
