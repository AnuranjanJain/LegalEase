# Refresh Token Implementation

## Overview

This document describes the production-grade refresh token mechanism implemented for session restoration and secure authentication management in LegalEase.

## Architecture

### Token Types

The system uses two types of JWT tokens:

1. **Access Token**: Short-lived JWT (24 hours) used for API authentication
   - Stored in frontend memory only
   - Sent in Authorization: Bearer header
   - Stateless with jti-based revocation support

2. **Refresh Token**: Long-lived JWT (7 days, configurable) used for session restoration
   - Stored in HttpOnly Secure SameSite cookie
   - Never accessible to JavaScript
   - Database-backed for revocation and rotation

### Authentication Flow

```
User Login
    ↓
Issue Access Token (24h) + Refresh Token (7d)
    ↓
Return access token in JSON + refresh token in HttpOnly cookie
    ↓
Browser refreshes page
    ↓
Frontend calls GET /auth/refresh
    ↓
Backend validates refresh token from cookie
    ↓
Generate new access token
    ↓
Optionally rotate refresh token (if enabled)
    ↓
Return new access token in JSON + new refresh token in cookie
    ↓
Frontend restores session
```

## Configuration

### Environment Variables

```bash
# Refresh Token Configuration
REFRESH_TOKEN_EXPIRE_DAYS=7                    # Default: 7 days
REFRESH_TOKEN_COOKIE_NAME=refresh_token         # Default: refresh_token
REFRESH_TOKEN_ROTATION_ENABLED=true             # Default: true
```

### Cookie Configuration

Refresh token cookies are configured with:
- **HttpOnly**: Prevents JavaScript access (XSS protection)
- **Secure**: HTTPS-only in production (MITM protection)
- **SameSite=Lax**: CSRF protection while maintaining UX
- **Path=/**: Available application-wide
- **Max-Age**: Matches token expiration (7 days default)

## Database Schema

### RefreshToken Model

```python
class RefreshToken(Base):
    """
    Stores refresh tokens for session restoration and token rotation.
    Enables revocation of refresh tokens and detection of replay attacks.
    """
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    token_jti = Column(String, nullable=False, unique=True, index=True)
    expires_at = Column(DateTime, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    revoked_at = Column(DateTime, nullable=True)
    replaced_by_token_jti = Column(String, nullable=True, index=True)  # Rotation tracking
```

### Fields

- **token_jti**: JWT ID for token identification and revocation
- **expires_at**: Token expiration time for cleanup
- **revoked_at**: Set when token is revoked (logout, security event)
- **replaced_by_token_jti**: Points to new token after rotation (replay protection)

## Security Features

### Token Rotation

When enabled (`REFRESH_TOKEN_ROTATION_ENABLED=true`):
1. Old refresh token is marked as replaced
2. New refresh token is issued
3. If an old (replaced) token is used again, it's rejected (replay attack detection)

### Revocation

Refresh tokens can be revoked:
- **On logout**: Token marked as revoked in database
- **On password change**: All user tokens can be revoked
- **On security events**: Admin can revoke specific tokens

### Validation

The refresh endpoint validates:
- JWT signature
- Token expiration
- Token type (must be "refresh")
- Database revocation status
- User existence
- Token rotation status (replay detection)

## API Endpoints

### POST /auth/login

Issues both access and refresh tokens on successful login.

**Response:**
```json
{
  "access_token": "<jwt>",
  "token_type": "bearer"
}
```

**Cookie:** `refresh_token=<jwt>; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`

### POST /auth/signup

Issues both access and refresh tokens on successful signup.

**Response:**
```json
{
  "access_token": "<jwt>",
  "token_type": "bearer"
}
```

**Cookie:** `refresh_token=<jwt>; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`

### GET /auth/refresh

Refreshes access token using refresh token from cookie.

**Request:** Requires valid refresh token in HttpOnly cookie

**Response:**
```json
{
  "access_token": "<jwt>",
  "token_type": "bearer"
}
```

**Cookie:** Updated with new refresh token (if rotation enabled)

**Error Responses:**
- `401 Unauthorized`: Missing, invalid, expired, or revoked refresh token

### POST /auth/logout

Invalidates both access token and refresh token.

**Response:**
```json
{
  "detail": "Logged out successfully"
}
```

**Cookie:** Refresh token cookie cleared

## Token Lifecycle

### Access Token

1. **Creation**: Issued on login/signup/refresh
2. **Usage**: Sent in Authorization header for API calls
3. **Expiration**: 24 hours (configurable via ACCESS_TOKEN_EXPIRE_HOURS)
4. **Revocation**: jti stored in RevokedToken table on logout

### Refresh Token

1. **Creation**: Issued on login/signup
2. **Storage**: HttpOnly cookie + database record
3. **Usage**: Called by frontend on page refresh
4. **Rotation**: Replaced with new token on each refresh (if enabled)
5. **Expiration**: 7 days (configurable via REFRESH_TOKEN_EXPIRE_DAYS)
6. **Revocation**: Marked as revoked in database on logout

## Security Best Practices

### Why HttpOnly Cookies?

- **XSS Protection**: JavaScript cannot access the token
- **Automatic Transmission**: Browser sends cookie with requests
- **No Storage Complexity**: No localStorage/sessionStorage management

### Why Token Rotation?

- **Replay Attack Prevention**: Old tokens cannot be reused
- **Limited Window**: Stolen tokens have short useful lifetime
- **Detection**: Replayed tokens trigger security alerts

### Why Database-Backed?

- **Revocation**: Tokens can be invalidated before expiration
- **Rotation Tracking**: Detect replay attempts
- **Cleanup**: Expired tokens can be purged
- **Audit**: Token issuance and usage can be audited

## Migration Notes

### Existing Users

Users with existing access tokens will continue to work. Refresh tokens are only issued on new login/signup requests.

### Database Migration

The `refresh_tokens` table is created automatically via SQLAlchemy's `create_all`. No manual migration is required.

### Frontend Integration

The frontend should:
1. Call `GET /auth/refresh` on application start
2. Store the new access token in memory
3. Use the access token for API calls
4. Handle 401 responses by redirecting to login

## Troubleshooting

### Session Not Restoring After Refresh

1. Check browser console for 401 errors
2. Verify refresh token cookie is present
3. Check cookie settings (HttpOnly, Secure, SameSite)
4. Verify `REFRESH_TOKEN_ROTATION_ENABLED` setting

### Refresh Token Invalid

1. Check token expiration in database
2. Verify token is not revoked
3. Check user still exists in database
4. Verify JWT_SECRET_KEY is consistent

### Cookie Not Being Set

1. Check browser cookie settings
2. Verify CORS configuration allows credentials
3. Check for conflicting cookie names
4. Verify domain/path settings

## Testing

### Manual Testing

```bash
# Login and get refresh token
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}' \
  -c cookies.txt

# Use refresh token to get new access token
curl -X GET http://localhost:8000/auth/refresh \
  -b cookies.txt \
  -c cookies.txt

# Logout and clear refresh token
curl -X POST http://localhost:8000/auth/logout \
  -H "Authorization: Bearer <access_token>" \
  -b cookies.txt \
  -c cookies.txt
```

### Automated Testing

See test suite for comprehensive refresh token flow tests including:
- Valid refresh token
- Expired refresh token
- Invalid signature
- Revoked token
- Wrong token type
- Missing cookie
- Replay detection
- Token rotation

## References

- [RFC 6749 - OAuth 2.0](https://tools.ietf.org/html/rfc6749)
- [OWASP Token Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Token_Storage_Cheat_Sheet.html)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
