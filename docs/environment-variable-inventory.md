# Environment Variable Inventory

## Overview
This document catalogs all environment variables used across the LegalEase application, their types, default values, current validation status, and file locations.

## Environment Variables by Category

### Authentication & Security

| Variable Name | Type | Default | Required | Current Validation | File Location |
|--------------|------|---------|----------|-------------------|---------------|
| JWT_SECRET_KEY | string | None | Yes | Runtime check in auth.py | backend/auth.py |
| API_KEYS | string | "" | No | None | backend/auth.py |
| ALLOW_DEV | boolean | false | No | Manual string comparison | backend/auth.py |
| DEV_API_KEY | string | dev-token | No | None | backend/auth.py |
| ENVIRONMENT | string | production | No | None | backend/routers/auth_routes.py |
| TEST_MODE | boolean | false | No | Manual string comparison | backend/routers/auth_routes.py |

### Database

| Variable Name | Type | Default | Required | Current Validation | File Location |
|--------------|------|---------|----------|-------------------|---------------|
| DATABASE_URL | string | SQLite fallback | No | Scheme normalization | backend/database.py |
| VERCEL | string | None | No | None | backend/database.py |
| REDIS_URL | string | None | No | None | backend/utils/limiter.py |

### File Upload & Processing

| Variable Name | Type | Default | Required | Current Validation | File Location |
|--------------|------|---------|----------|-------------------|---------------|
| MAX_UPLOAD_SIZE | int | 26214400 (25MB) | No | None | backend/main.py |
| MAX_PDF_PAGES | int | 100 | No | None | backend/main.py |
| MAX_DOCX_PARAGRAPHS | int | 2000 | No | None | backend/main.py |
| MAX_EXTRACTED_TEXT_CHARS | int | 10000 | No | None | backend/main.py |
| UPLOAD_PARSE_TIMEOUT_SECONDS | float | 5.0 | No | None | backend/main.py |
| TOKEN_CLEANUP_INTERVAL_SECONDS | int | 3600 | No | None | backend/main.py |

### Input Validation Limits

| Variable Name | Type | Default | Required | Current Validation | File Location |
|--------------|------|---------|----------|-------------------|---------------|
| MAX_CHAT_INPUT_CHARS | int | 4000 | No | None | backend/core/validation.py |
| MAX_SUMMARIZE_INPUT_CHARS | int | 20000 | No | None | backend/core/validation.py |
| MAX_SIMPLIFY_INPUT_CHARS | int | 10000 | No | None | backend/core/validation.py |
| MAX_CONTEXT_INPUT_CHARS | int | 10000 | No | None | backend/core/validation.py |
| MAX_DOCX_ARCHIVE_ENTRIES | int | 200 | No | None | backend/core/validation.py |
| MAX_DOCX_ARCHIVE_UNCOMPRESSED_BYTES | int | 10485760 (10MB) | No | None | backend/core/validation.py |
| MAX_DOCX_ARCHIVE_ENTRY_BYTES | int | 5242880 (5MB) | No | None | backend/core/validation.py |
| MAX_DOCX_ARCHIVE_RATIO | float | 100.0 | No | None | backend/core/validation.py |
| MAX_DOCX_XML_BYTES | int | 5242880 (5MB) | No | None | backend/core/validation.py |

### Rate Limiting

| Variable Name | Type | Default | Required | Current Validation | File Location |
|--------------|------|---------|----------|-------------------|---------------|
| RATE_LIMIT_PERIOD | int | 60 | No | None | backend/main.py, backend/middleware/rate_limit.py |
| RATE_LIMIT_KEY_CALLS | int | 300 | No | None | backend/main.py |
| RATE_LIMIT_IP_CALLS | int | 60 | No | None | backend/middleware/rate_limit.py |
| TRUST_PROXY_HEADERS | boolean | false | No | Manual string comparison | backend/middleware/rate_limit.py |
| AUTH_LOGIN_RATE_LIMIT | int | 5 | No | None | backend/middleware/auth_rate_limit.py |
| AUTH_LOGIN_RATE_PERIOD | int | 60 | No | None | backend/middleware/auth_rate_limit.py |
| AUTH_LOGIN_FAILED_ATTEMPT_LIMIT | int | 10 | No | None | backend/middleware/auth_rate_limit.py |
| AUTH_LOGIN_FAILED_ATTEMPT_PERIOD | int | 300 | No | None | backend/middleware/auth_rate_limit.py |
| AUTH_LOGIN_LOCKOUT_DURATION | int | 900 | No | None | backend/middleware/auth_rate_limit.py |
| AUTH_SIGNUP_RATE_LIMIT | int | 3 | No | None | backend/middleware/auth_rate_limit.py |
| AUTH_SIGNUP_RATE_PERIOD | int | 3600 | No | None | backend/middleware/auth_rate_limit.py |
| AUTH_VERIFICATION_RATE_LIMIT | int | 3 | No | None | backend/middleware/auth_rate_limit.py |
| AUTH_VERIFICATION_RATE_PERIOD | int | 3600 | No | None | backend/middleware/auth_rate_limit.py |
| COMPARE_RATE_LIMIT_CALLS | int | 60 | No | None | backend/routers/compare_routes.py |
| COMPARE_RATE_LIMIT_PERIOD | int | 60 | No | None | backend/routers/compare_routes.py |

### AI Service Configuration

| Variable Name | Type | Default | Required | Current Validation | File Location |
|--------------|------|---------|----------|-------------------|---------------|
| BYTEZ_API_KEY | string | None | No | None | backend/services/ai_service.py |
| CHAT_MODEL | string | inference-net/Schematron-3B | No | None | backend/services/ai_service.py |
| SUMMARIZE_MODEL | string | inference-net/Schematron-3B | No | None | backend/services/ai_service.py |
| MAX_MODEL_INPUT_CHARS | int | 15000 | No | None | backend/services/ai_service.py |
| PROVIDER_TIMEOUT | float | 30.0 | No | None | backend/services/ai_service.py |
| PROVIDER_RETRIES | int | 3 | No | None | backend/services/ai_service.py |
| RETRY_BACKOFF_FACTOR | float | 2.0 | No | None | backend/services/ai_service.py |
| GRACEFUL_DEGRADATION | boolean | true | No | Manual string comparison | backend/services/ai_service.py |
| STUB_MODE | boolean | false | No | Manual string comparison | backend/services/ai_service.py |
| HEALTH_DEBUG | boolean | false | No | Manual string comparison | backend/services/ai_service.py |

### Document Comparison

| Variable Name | Type | Default | Required | Current Validation | File Location |
|--------------|------|---------|----------|-------------------|---------------|
| COMPARE_MAX_CONTEXT_CHARS | int | 14000 | No | None | backend/services/comparison_service.py |
| COMPARE_MAX_DOCUMENTS | int | 10 | No | None | backend/services/comparison_service.py |

### CORS Configuration

| Variable Name | Type | Default | Required | Current Validation | File Location |
|--------------|------|---------|----------|-------------------|---------------|
| ALLOWED_ORIGINS | string | http://localhost:5173 | No | None | backend/main.py |
| FRONTEND_URL | string | http://localhost:5173 | No | None | backend/main.py |

## Summary Statistics

- **Total Environment Variables**: 52
- **Variables with Validation**: 1 (JWT_SECRET_KEY - runtime check only)
- **Variables without Validation**: 51
- **Required Variables**: 1 (JWT_SECRET_KEY)
- **Optional Variables**: 51
- **Integer Variables**: 28
- **Float Variables**: 4
- **String Variables**: 14
- **Boolean Variables**: 6

## Current Validation Issues

1. **Type Conversion Failures**: Most variables use direct `int()` or `float()` calls without error handling, which can cause ValueError on invalid input.
2. **No Range Validation**: Numeric variables have no minimum/maximum bounds checking.
3. **Inconsistent Boolean Parsing**: Boolean variables use inconsistent string comparison patterns.
4. **No Required Variable Validation**: Only JWT_SECRET_KEY has a runtime check; other potentially required variables lack validation.
5. **Scattered Configuration**: Configuration logic is distributed across 12 files, making maintenance difficult.
6. **Silent Failures**: Invalid values may cause unexpected behavior or crashes at runtime rather than failing fast at startup.

## Failure Scenarios

### Invalid Integer Values
- `RATE_LIMIT_PERIOD=abc` → ValueError during module import
- `MAX_UPLOAD_SIZE=-1` → Negative value accepted, causes logic errors
- `MAX_PDF_PAGES=0` → Zero value accepted, breaks document processing

### Invalid Float Values
- `UPLOAD_PARSE_TIMEOUT_SECONDS=hello` → ValueError during module import
- `PROVIDER_TIMEOUT=-5.0` → Negative timeout accepted

### Invalid Boolean Values
- `ALLOW_DEV=maybe` → Treated as false (not in accepted values)
- `GRACEFUL_DEGRADATION=yes` → Works, but inconsistent parsing

### Empty or Missing Values
- `JWT_SECRET_KEY=` → Runtime error after startup
- `DATABASE_URL=` → Falls back to SQLite (may be unintended)
- `API_KEYS=` → Empty list accepted

### Unsafe Values
- `MAX_UPLOAD_SIZE=999999999999` → Excessively large value could cause memory issues
- `RATE_LIMIT_PERIOD=0` → Zero period could cause division by zero
- `PROVIDER_RETRIES=1000` → Excessive retries could hang requests

## Recommendations

1. Implement centralized Pydantic Settings for all configuration
2. Add type validation with clear error messages
3. Add range validation for numeric values
4. Standardize boolean parsing
5. Add required field validation at startup
6. Add environment-specific validation (e.g., stricter checks in production)
7. Provide clear error messages that identify the offending variable
8. Fail fast at startup rather than at runtime
