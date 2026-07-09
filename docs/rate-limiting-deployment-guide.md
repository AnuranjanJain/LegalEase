# Rate Limiting Deployment Guide

## Overview

This document provides deployment recommendations and configuration guidance for the application's rate limiting system. The rate limiter supports both in-memory (process-local) and Redis-based (distributed) storage backends.

## Architecture

### Storage Backends

The rate limiter automatically selects a storage backend based on configuration:

1. **Redis Backend (Distributed)**
   - Used when `REDIS_URL` is configured and connection succeeds
   - Shares rate limit state across all application workers and instances
   - Required for distributed deployments with multiple workers
   - Provides consistent rate limiting across the entire deployment

2. **In-Memory Backend (Process-Local)**
   - Used when `REDIS_URL` is not configured or Redis connection fails
   - Each process maintains its own independent rate limiter
   - Appropriate for local development and single-instance deployments
   - Not suitable for distributed deployments with multiple workers

### Backend Selection Logic

```
REDIS_URL configured?
├─ Yes → Try Redis connection
│   ├─ Success → Use Redis backend
│   └─ Failure → Check REDIS_FAIL_FAST
│       ├─ Enabled → Fail to start (RuntimeError)
│       └─ Disabled → Fall back to in-memory (with warning)
└─ No → Use in-memory backend
    └─ Check environment and REQUIRE_REDIS_IN_PRODUCTION
        ├─ Production + Enabled → Log error
        ├─ Production + Disabled → Log warning
        └─ Development → Log info
```

## Configuration Options

### Environment Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `REDIS_URL` | string | `None` | Redis connection URL (e.g., `redis://localhost:6379/0`) |
| `REQUIRE_REDIS_IN_PRODUCTION` | bool | `false` | Log error if Redis not configured in production |
| `REDIS_FAIL_FAST` | bool | `false` | Fail to start if Redis connection fails |
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
# REDIS_URL not set
REQUIRE_REDIS_IN_PRODUCTION=false
REDIS_FAIL_FAST=false
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
# REDIS_URL not set
REQUIRE_REDIS_IN_PRODUCTION=false
REDIS_FAIL_FAST=false
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
REDIS_URL=redis://your-redis-host:6379/0
REQUIRE_REDIS_IN_PRODUCTION=true
REDIS_FAIL_FAST=true
```

**Behavior:**
- Uses Redis backend
- Logs: "Rate limiter: Using Redis backend (distributed)"
- Consistent rate limiting across all workers
- Fails to start if Redis is unavailable (with REDIS_FAIL_FAST)

**Recommendation:** This is the recommended configuration for production deployments with multiple workers.

### Staging Environment

**Configuration:**
```bash
ENVIRONMENT=staging
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
   WARNING: REDIS_URL is not configured in production environment.
   Rate limiting will use in-memory storage, which is not suitable for distributed deployments.
   Multiple workers or application instances will have independent rate limiters.
   Consider setting REDIS_URL for distributed rate limiting.
   ```

2. **Redis connection failure:**
   ```
   ERROR: Failed to initialize Redis rate limiting backend: [error details].
   Falling back to in-memory storage. Rate limiting will be process-local only.
   ```

3. **REQUIRE_REDIS_IN_PRODUCTION enabled without Redis:**
   ```
   ERROR: REQUIRE_REDIS_IN_PRODUCTION is enabled but REDIS_URL is not configured.
   Rate limiting will use in-memory storage, which is not suitable for distributed deployments.
   Set REDIS_URL or disable REQUIRE_REDIS_IN_PRODUCTION.
   ```

### Fail-Fast Behavior

When `REDIS_FAIL_FAST=true`:
- Application fails to start if Redis URL is configured but connection fails
- Provides clear error message for troubleshooting
- Ensures distributed rate limiting is available before accepting traffic
- Recommended for production deployments

**Example error:**
```
RuntimeError: Redis initialization failed with REDIS_FAIL_FAST enabled: [error details].
Please verify REDIS_URL is correct and Redis is accessible.
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

This implementation maintains full backward compatibility:

- Existing deployments without Redis continue to work
- In-memory backend remains the default when Redis is not configured
- No breaking changes to rate limiter API
- Existing rate limit configuration variables unchanged
- New configuration options are opt-in with safe defaults

## Summary

| Deployment Type | Redis Required | REQUIRE_REDIS_IN_PRODUCTION | REDIS_FAIL_FAST |
|-----------------|----------------|------------------------------|-----------------|
| Local Development | No | false | false |
| Single-Instance Production | Optional | false | false |
| Multi-Worker Production | Yes | true | true |
| Staging | Recommended | false | false |

For distributed production deployments, Redis is strongly recommended to ensure consistent rate limiting across all application workers.
