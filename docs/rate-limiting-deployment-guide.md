# Rate Limiting Deployment Guide

## Overview

This document provides deployment recommendations and configuration guidance for the application's rate limiting system. The rate limiter supports both in-memory (process-local) and Redis-based (distributed) storage backends.

**Security Note:** The application no longer silently falls back to in-memory storage at runtime. Backend selection happens at startup, and the chosen backend is used consistently. In production, Redis is required for distributed rate limiting to prevent security bypass.

## Architecture

### Storage Backends

The rate limiter uses a single storage backend consistently based on configuration:

1. **Redis Backend (Distributed)**
   - Used when `RATE_LIMIT_BACKEND=redis` or `auto` with Redis available
   - Shares rate limit state across all application workers and instances
   - Required for distributed deployments with multiple workers
   - Provides consistent rate limiting across the entire deployment
   - **No runtime fallback** - if Redis fails at runtime, errors are raised

2. **In-Memory Backend (Process-Local)**
   - Used when `RATE_LIMIT_BACKEND=memory` or Redis unavailable
   - Each process maintains its own independent rate limiter
   - Appropriate for local development and single-instance deployments
   - **Not suitable for distributed deployments** - rate limits become process-local
   - Safe for development/testing environments

### Backend Selection Logic

```
RATE_LIMIT_BACKEND setting:
├─ "redis" → Require Redis
│   ├─ REDIS_URL configured?
│   │   ├─ Yes → Try Redis connection
│   │   │   ├─ Success → Use Redis backend
│   │   │   └─ Failure → Check environment
│   │   │       ├─ Production → Fail to start (RuntimeError)
│   │   │       └─ Development → Fall back to memory (warning)
│   │   └─ No → Check environment
│   │       ├─ Production → Fail to start (RuntimeError)
│   │       └─ Development → Fall back to memory (warning)
├─ "memory" → Always use in-memory
│   └─ Production → Log warning (unsafe for distributed)
└─ "auto" → Automatic selection
    ├─ REDIS_URL configured?
    │   ├─ Yes → Try Redis connection
    │   │   ├─ Success → Use Redis backend
    │   │   └─ Failure → Check REQUIRE_REDIS_IN_PRODUCTION
    │   │       ├─ Production + Enabled → Fail to start (RuntimeError)
    │   │       └─ Development/Disabled → Fall back to memory (warning)
    │   └─ No → Check REQUIRE_REDIS_IN_PRODUCTION
    │       ├─ Production + Enabled → Fail to start (RuntimeError)
    │       └─ Development/Disabled → Use memory (info/warning)
```

## Configuration Options

### Environment Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `RATE_LIMIT_BACKEND` | string | `auto` | Backend selection: "redis", "memory", or "auto" |
| `REDIS_URL` | string | `None` | Redis connection URL (e.g., `redis://localhost:6379/0`) |
| `REQUIRE_REDIS_IN_PRODUCTION` | bool | `true` | Require Redis for rate limiting in production |
| `REDIS_FAIL_FAST` | bool | `true` | Fail to start if Redis URL configured but connection fails |
| `ENVIRONMENT` | string | `production` | Application environment (development, testing, staging, production, local) |

### Rate Limiting Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `RATE_LIMIT_PERIOD` | int | `60` | Rate limit period in seconds |
| `RATE_LIMIT_KEY_CALLS` | int | `300` | Calls per period for API keys |
| `RATE_LIMIT_IP_CALLS` | int | `60` | Calls per period for IP addresses |

## Deployment Scenarios

### Local Development

**Configuration:**
```bash
ENVIRONMENT=development
RATE_LIMIT_BACKEND=auto
# REDIS_URL not set
REQUIRE_REDIS_IN_PRODUCTION=true
REDIS_FAIL_FAST=true
```

**Behavior:**
- Uses in-memory rate limiting
- Logs: "Rate limiter: Using in-memory backend (process-local only)"
- Appropriate for single-process development

**Recommendation:** No Redis required. In-memory backend is sufficient.

### Single-Instance Production

**Configuration:**
```bash
ENVIRONMENT=production
RATE_LIMIT_BACKEND=memory
# REDIS_URL not set
REQUIRE_REDIS_IN_PRODUCTION=false
REDIS_FAIL_FAST=true
```

**Behavior:**
- Uses in-memory rate limiting
- Logs warning about distributed deployment limitations
- Each worker process has independent rate limiter

**Recommendation:** Consider Redis if using multiple workers. For single-worker deployments, in-memory is acceptable but not ideal.

### Multi-Worker Production (Recommended)

**Configuration:**
```bash
ENVIRONMENT=production
RATE_LIMIT_BACKEND=redis
REDIS_URL=redis://your-redis-host:6379/0
REQUIRE_REDIS_IN_PRODUCTION=true
REDIS_FAIL_FAST=true
```

**Behavior:**
- Uses Redis backend
- Logs: "Rate limiter: Using Redis backend (distributed)"
- Consistent rate limiting across all workers
- Fails to start if Redis is unavailable (with REDIS_FAIL_FAST)
- No runtime fallback - Redis failures raise exceptions

**Recommendation:** This is the recommended configuration for production deployments with multiple workers.

### Staging Environment

**Configuration:**
```bash
ENVIRONMENT=staging
RATE_LIMIT_BACKEND=auto
REDIS_URL=redis://staging-redis:6379/0
REQUIRE_REDIS_IN_PRODUCTION=false
REDIS_FAIL_FAST=false
```

**Behavior:**
- Uses Redis backend if available
- Falls back to in-memory if Redis fails (with warning)
- Does not fail to start on Redis connection failure

**Recommendation:** Use Redis to mirror production configuration, but allow fallback for testing.

## Production Safety Features

### Startup Warnings

The application provides clear warnings at startup when rate limiting configuration may not be suitable for the deployment:

1. **Production without Redis:**
   ```
   WARNING: REDIS_URL not configured in production environment.
   Using in-memory rate limiting (process-local only).
   This is unsafe for distributed deployments.
   ```

2. **RATE_LIMIT_BACKEND=memory in production:**
   ```
   WARNING: RATE_LIMIT_BACKEND is set to 'memory' in production environment.
   Rate limiting will be process-local only, which is unsafe for distributed deployments.
   Consider setting RATE_LIMIT_BACKEND to 'redis' for distributed rate limiting.
   ```

3. **Redis connection failure in development:**
   ```
   WARNING: Redis health check failed: [error details].
   Falling back to in-memory storage for development.
   ```

4. **REQUIRE_REDIS_IN_PRODUCTION enabled without Redis:**
   ```
   CRITICAL: REQUIRE_REDIS_IN_PRODUCTION is enabled but REDIS_URL is not configured.
   Refusing to start because distributed rate limiting is required.
   ```

### Fail-Fast Behavior

When `REDIS_FAIL_FAST=true`:
- Application fails to start if Redis URL is configured but connection fails
- Provides clear error message for troubleshooting
- Ensures distributed rate limiting is available before accepting traffic
- Recommended for production deployments

**Example error:**
```
RuntimeError: Redis health check failed with REDIS_FAIL_FAST enabled: [error details].
Please verify REDIS_URL is correct and Redis is accessible.
```

### No Runtime Fallback

**Critical Security Change:** The application no longer silently falls back to in-memory storage at runtime.

- Backend selection happens at startup and is used consistently
- If Redis fails at runtime in production, errors are raised (not silently ignored)
- This prevents attackers from bypassing rate limits by distributing requests across workers
- Runtime Redis failures are logged as CRITICAL in production

**Example runtime error:**
```
CRITICAL: Redis rate limiter check failed in production.
This may allow rate limit bypass. Check Redis connectivity.
```

## Redis Configuration

### Redis URL Format

```
redis://[username:password@]host:port/database
rediss://[username:password@]host:port/database  # TLS
```

### Examples

```bash
# Local Redis
REDIS_URL=redis://localhost:6379/0

# Redis with password
REDIS_URL=redis://:password@localhost:6379/0

# Redis with username and password
REDIS_URL=redis://username:password@localhost:6379/0

# Redis with TLS
REDIS_URL=rediss://localhost:6379/0

# Managed Redis service (e.g., AWS ElastiCache)
REDIS_URL=redis://my-cluster.xxxxxx.use1.cache.amazonaws.com:6379/0
```

### Redis Requirements

- Redis version 2.6+ (for INCR and EXPIRE operations)
- Network connectivity from application to Redis
- Sufficient memory for rate limit keys (automatically expired)
- Recommended: Redis persistence configuration for durability

## Monitoring and Troubleshooting

### Startup Logs

Check application startup logs for rate limiter initialization:

```
INFO: Redis rate limiting storage backend initialized successfully. Environment: production, Redis URL: redis://localhost:6379...
INFO: Rate limiter: Using Redis backend (distributed)
```

Or:

```
WARNING: Rate limiter: Using in-memory backend (process-local only)
```

### Health Checks

The `/health` endpoint provides service status. Monitor for:
- Rate limiter backend selection in logs
- Redis connection errors
- Rate limit enforcement consistency

### Common Issues

**Issue:** Inconsistent rate limiting across workers
- **Cause:** Using in-memory backend with multiple workers
- **Solution:** Configure `REDIS_URL` and ensure Redis connectivity

**Issue:** Application fails to start
- **Cause:** `REDIS_FAIL_FAST` enabled but Redis unavailable
- **Solution:** Fix Redis connection or disable `REDIS_FAIL_FAST`

**Issue:** Redis connection errors in logs
- **Cause:** Network issues, wrong URL, or Redis down
- **Solution:** Verify `REDIS_URL`, network connectivity, and Redis status

## Migration Guide

### From In-Memory to Redis

1. **Deploy Redis:**
   - Set up Redis instance (local or managed service)
   - Verify connectivity from application

2. **Configure Application:**
   ```bash
   REDIS_URL=redis://your-redis-host:6379/0
   REQUIRE_REDIS_IN_PRODUCTION=true
   REDIS_FAIL_FAST=false  # Start with false for testing
   ```

3. **Deploy and Monitor:**
   - Deploy with `REDIS_FAIL_FAST=false`
   - Monitor logs for successful Redis initialization
   - Verify rate limiting behavior

4. **Enable Fail-Fast:**
   ```bash
   REDIS_FAIL_FAST=true
   ```
   - Deploy after confirming Redis stability

### Testing Redis Configuration

Before enabling `REDIS_FAIL_FAST` in production:

1. Test Redis connectivity from application environment
2. Verify Redis URL format and credentials
3. Monitor Redis performance under load
4. Test failover scenarios if using Redis clustering

## Best Practices

### Development
- Use in-memory backend for simplicity
- No Redis required
- Set `ENVIRONMENT=development`

### Staging
- Mirror production configuration with Redis
- Use `REDIS_FAIL_FAST=false` for testing
- Monitor Redis performance and connectivity

### Production
- Always use Redis for distributed deployments
- Enable `REQUIRE_REDIS_IN_PRODUCTION=true`
- Enable `REDIS_FAIL_FAST=true` for strict enforcement
- Monitor Redis health and performance
- Implement Redis monitoring and alerting
- Use Redis persistence for durability

### Security
- Use TLS (`rediss://`) for Redis connections in production
- Secure Redis with authentication
- Use Redis ACLs if available
- Network isolation (VPC, private subnets)
- Regular Redis security updates

### High Availability
- Use Redis clustering or Sentinel for HA
- Configure Redis persistence (RDB + AOF)
- Monitor Redis memory usage
- Implement Redis backup strategy
- Test Redis failover procedures

## Backward Compatibility

This implementation maintains backward compatibility with important security improvements:

- Existing deployments without Redis continue to work in development/testing
- In-memory backend is available via `RATE_LIMIT_BACKEND=memory`
- No breaking changes to rate limiter API
- Existing rate limit configuration variables unchanged
- New configuration options have safe defaults (`RATE_LIMIT_BACKEND=auto`)

**Important Changes:**
- Production deployments now require Redis by default (`REQUIRE_REDIS_IN_PRODUCTION=true`)
- Runtime fallback has been eliminated for security
- Direct `SimpleRateLimiter()` instantiation is deprecated; use `create_rate_limiter()`

## Summary

| Deployment Type | RATE_LIMIT_BACKEND | Redis Required | REQUIRE_REDIS_IN_PRODUCTION | REDIS_FAIL_FAST |
|-----------------|-------------------|----------------|------------------------------|-----------------|
| Local Development | auto | No | true | true |
| Single-Instance Production | memory | No | false | true |
| Multi-Worker Production | redis | Yes | true | true |
| Staging | auto | Recommended | false | false |

For distributed production deployments, Redis is required to ensure consistent rate limiting across all application workers and prevent security bypass.
