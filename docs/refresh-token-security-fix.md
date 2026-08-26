# Refresh Token Rotation Security Fix

## Overview

This document describes critical security improvements to the refresh token rotation mechanism in the LegalEase authentication system. These changes address a vulnerability where refresh token rotation failures were silently ignored, potentially allowing replay attacks and breaking rotation guarantees.

## Problem Statement

### Original Vulnerability

The `/auth/refresh` endpoint previously called `rotate_refresh_token()` but **ignored the return value**. If rotation failed:

- The previous refresh token remained usable
- Multiple refresh tokens could remain valid simultaneously
- Replay attacks became possible
- Refresh-token rotation guarantees were broken

### Security Impact

Without proper rotation enforcement:
- Attackers could reuse old refresh tokens after rotation
- Session hijacking risks increased
- Token revocation became ineffective
- The security model of "one valid refresh token per session" was violated

## Solution

### 1. Mandatory Rotation with Fail-Closed Behavior

**File**: `backend/routers/auth_routes.py`

The refresh endpoint now enforces mandatory rotation when enabled:

```python
# Rotation is now mandatory - if it fails, the entire operation fails
rotation_success, new_jti = rotate_refresh_token(old_jti, new_refresh_token, db)

if not rotation_success:
    # Rotation failed - revoke new token and fail the request
    logger.error(
        f"Refresh token rotation failed for user {email} (old_jti={old_jti}). "
        f"Failing refresh request to prevent security vulnerability."
    )
    # Revoke the newly created token to prevent orphan tokens
    revoke_refresh_token(new_jti, db)
    
    # Clear cookie and fail
    clear_refresh_token_cookie(response)
    db.rollback()
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token rotation failed. Please re-authenticate.",
    )
```

### 2. Atomic Rotation with Database Transactions

**File**: `backend/auth.py`

The `rotate_refresh_token()` function now:

- Returns a tuple `(success, new_jti)` instead of just a boolean
- Performs atomic database operations with rollback on failure
- Checks if the old token is already revoked or replaced before rotation
- Includes comprehensive error handling

```python
def rotate_refresh_token(old_jti: str, new_token: str, db: Session) -> tuple[bool, Optional[str]]:
    """
    Rotate a refresh token by marking the old one as replaced by the new one.
    
    This function is atomic: either the rotation succeeds completely,
    or it fails with no partial state changes.
    
    Returns:
        Tuple of (success, new_jti) where:
        - success: True if rotation succeeded, False otherwise
        - new_jti: The new token's JTI if success=True, None otherwise
    """
    # Check if old token is already revoked or replaced
    if old_token.revoked_at is not None:
        return False, None
    
    if old_token.replaced_by_token_jti is not None:
        return False, None
    
    # Perform the rotation atomically
    try:
        old_token.replaced_by_token_jti = new_jti
        db.commit()
        return True, new_jti
    except Exception as e:
        db.rollback()
        logger.error(f"Database error during rotation: {str(e)}")
        return False, None
```

### 3. Replay Attack Detection

**File**: `backend/auth.py`

The `validate_refresh_token()` function now detects replay attacks:

```python
# REPLAY ATTACK DETECTION: Check if this token has been replaced
if refresh_token_record.replaced_by_token_jti is not None:
    # This token was already used for rotation and replaced
    # Reusing it is a replay attack
    logger.warning(
        f"Replay attack detected: refresh token already rotated "
        f"(jti={jti}, replaced_by={refresh_token_record.replaced_by_token_jti}, "
        f"user={email}, ip={request_ip})"
    )
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Refresh token already used. Please re-authenticate.",
        headers={"WWW-Authenticate": "Bearer"},
    )
```

### 4. Structured Logging

All security events now include structured logging with:

- User ID/email
- Token JTI (never the full token)
- Rotation success/failure
- Replay detection
- Client IP address
- Database errors

**Important**: Never logs refresh tokens, JWTs, or secrets.

### 5. Database Failure Handling

The refresh endpoint wraps the entire operation in a transaction:

```python
try:
    # Create new access token
    access_token = create_access_token(...)
    
    # Rotate refresh token if enabled (MANDATORY)
    if settings.security.refresh_token_rotation_enabled:
        new_refresh_token = create_refresh_token(...)
        rotation_success, new_jti = rotate_refresh_token(...)
        
        if not rotation_success:
            # Revoke new token, clear cookie, rollback, fail
            ...
    
    # Commit the transaction
    db.commit()
    
except SQLAlchemyError as e:
    # Database error - rollback and fail
    db.rollback()
    clear_refresh_token_cookie(response)
    raise HTTPException(status_code=500, detail="Database error during token refresh")
except Exception as e:
    # Unexpected error - rollback and fail
    db.rollback()
    clear_refresh_token_cookie(response)
    raise HTTPException(status_code=500, detail="Token refresh failed")
```

### 6. Safe Cookie Handling

On rotation failure:
- Clear the refresh token cookie
- Do not set a new cookie
- Do not leave stale cookies

## Security Guarantees

### Transactional Rotation

Refresh token rotation is now **atomic**:
- Either rotation succeeds completely (old token marked as replaced, new token issued)
- Or rotation fails completely (no tokens issued, no state changes, cookie cleared)

### Fail-Closed Behavior

If any part of rotation fails:
- No new refresh token is issued
- No new access token is issued
- Authentication cookies are cleared
- Client receives authentication error
- Database state is rolled back

### Replay Attack Prevention

- Old refresh tokens marked with `replaced_by_token_jti` cannot be reused
- Reuse attempts are logged with security context
- Reuse attempts return 401 Unauthorized

### No Orphan Tokens

If rotation fails after creating a new token:
- The new token is immediately revoked
- No partially rotated sessions exist
- No valid tokens remain without proper rotation tracking

## Configuration

Refresh token rotation is controlled by:

```env
REFRESH_TOKEN_ROTATION_ENABLED=true  # Default: true
```

When disabled, the refresh endpoint still validates tokens but does not rotate them.

## Testing

### Unit Tests

- `test_rotate_refresh_token_success` - Successful rotation
- `test_rotate_refresh_token_old_token_not_found` - Rotation fails when old token missing
- `test_rotate_refresh_token_new_token_invalid` - Rotation fails with invalid new token
- `test_rotate_refresh_token_old_token_already_revoked` - Rotation fails when old token revoked
- `test_rotate_refresh_token_old_token_already_replaced` - Rotation fails when old token already replaced
- `test_rotate_refresh_token_database_error_rollback` - Rollback on database error
- `test_validate_refresh_token_replay_attack_detected` - Replay attack detection

### Integration Tests

- `test_refresh_token_rotation` - End-to-end rotation flow
- `test_refresh_token_replay_attack` - Replay attack rejection
- `test_refresh_rotation_failure_clears_cookie` - Cookie clearing on failure

### Regression Tests

All existing authentication tests continue to pass:
- Login/signup still work
- Access tokens unchanged
- Logout still works
- Cookie handling preserved

## Migration Notes

### Breaking Changes

- `rotate_refresh_token()` signature changed from `bool` to `tuple[bool, Optional[str]]`
- Any custom code calling this function must be updated

### Database Schema

No schema changes required. The existing `RefreshToken` table already has the `replaced_by_token_jti` column.

### Configuration

No configuration changes required. Rotation is enabled by default.

## Security Rationale

### Why Mandatory Rotation?

Refresh token rotation is a critical security measure to limit the window of token compromise. If rotation fails silently, an attacker who obtains a refresh token can continue using it indefinitely, even after the legitimate user attempts to refresh their session.

### Why Fail-Closed?

Failing open (continuing despite rotation failure) would:
- Allow multiple valid refresh tokens to exist simultaneously
- Break the security model of single-use rotation
- Enable replay attacks
- Defeat the purpose of token rotation

### Why Replay Detection?

Without replay detection, an attacker who captures a refresh token during rotation could:
- Use the old token to obtain a new access token
- Continue the attack even after the legitimate user's session rotates
- Potentially obtain multiple valid refresh tokens through parallel attacks

## Monitoring

### Security Events to Monitor

1. **Rotation failures** - May indicate database issues or attacks
2. **Replay attack attempts** - Indicates token theft or capture
3. **Multiple rotation failures for same user** - May indicate targeted attack
4. **Database errors during rotation** - May indicate infrastructure issues

### Log Examples

```
# Successful rotation
INFO: Refresh token rotated successfully for user user@example.com (old_jti=abc123, new_jti=def456)

# Replay attack detected
WARNING: Replay attack detected: refresh token already rotated (jti=abc123, replaced_by=def456, user=user@example.com, ip=192.168.1.100)

# Rotation failure
ERROR: Refresh token rotation failed for user user@example.com (old_jti=abc123). Failing refresh request to prevent security vulnerability.
```

## References

- [OWASP Token Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html#token-storage)
- [OAuth 2.0 Security Best Current Practice](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics)
- [Refresh Token Rotation](https://auth0.com/docs/secure/tokens/refresh-tokens/refresh-token-rotation)
