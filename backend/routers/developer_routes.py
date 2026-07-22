import json
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from backend.auth import (
    AuthIdentity,
    generate_api_key,
    hash_api_key,
    validate_token_or_api_key,
)
from backend.database import get_db
from backend import models

router = APIRouter(prefix="/developer", tags=["developer"])

# Keep this list in sync with wherever endpoints call require_scope(...).
# Centralising it here means a typo'd scope string fails fast at key
# creation time rather than silently never matching at check time.
VALID_SCOPES = {
    "documents:read",
    "documents:write",
    "analysis:read",
    "analysis:write",
    "webhooks:manage",
}


# ---------------------------------------------------------------------------
# API keys
# ---------------------------------------------------------------------------

class ApiKeyCreateRequest(BaseModel):
    label: str = Field(..., min_length=1, max_length=100)
    scopes: List[str] = Field(default_factory=list)

    @field_validator("scopes")
    @classmethod
    def scopes_must_be_known(cls, value: List[str]) -> List[str]:
        unknown = set(value) - VALID_SCOPES
        if unknown:
            raise ValueError(f"Unknown scope(s): {', '.join(sorted(unknown))}")
        return value


class ApiKeyCreateResponse(BaseModel):
    id: int
    key: str  # plaintext — only ever returned on creation
    label: str
    scopes: List[str]
    created_at: datetime


class ApiKeyListItem(BaseModel):
    id: int
    label: str
    scopes: List[str]
    created_at: datetime
    revoked_at: Optional[datetime] = None
    # Last 4 chars only, so the owner can tell keys apart without the
    # plaintext ever being retrievable again after creation.
    key_suffix: str


def _require_user_id(identity: AuthIdentity) -> int:
    user_id = identity.get_user_id()
    if not user_id:
        # Deliberately excludes API-key callers: keys are managed by a
        # logged-in user, not minted by another key (no key-of-keys).
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Developer key/webhook management requires user login (JWT), not API key auth.",
        )
    return user_id


@router.post("/api-keys", response_model=ApiKeyCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_api_key(
    request: ApiKeyCreateRequest,
    identity: AuthIdentity = Depends(validate_token_or_api_key),
    db: Session = Depends(get_db),
):
    """
    Generate a new scoped API key for the current user. The plaintext key
    is returned exactly once — only its hash is persisted, mirroring how
    User.hashed_password is never recoverable either.
    """
    user_id = _require_user_id(identity)

    plaintext_key = generate_api_key()
    row = models.ApiKey(
        user_id=user_id,
        hashed_key=hash_api_key(plaintext_key),
        label=request.label,
        scopes=json.dumps(request.scopes),
        key_suffix=plaintext_key[-4:],
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    return ApiKeyCreateResponse(
        id=row.id,
        key=plaintext_key,
        label=row.label,
        scopes=request.scopes,
        created_at=row.created_at,
    )


@router.get("/api-keys", response_model=List[ApiKeyListItem])
async def list_api_keys(
    identity: AuthIdentity = Depends(validate_token_or_api_key),
    db: Session = Depends(get_db),
):
    user_id = _require_user_id(identity)
    rows = (
        db.query(models.ApiKey)
        .filter(models.ApiKey.user_id == user_id)
        .order_by(models.ApiKey.created_at.desc())
        .all()
    )
    return [
        ApiKeyListItem(
            id=r.id,
            label=r.label,
            scopes=json.loads(r.scopes or "[]"),
            created_at=r.created_at,
            revoked_at=r.revoked_at,
            key_suffix=r.key_suffix,
        )
        for r in rows
    ]


@router.delete("/api-keys/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_api_key(
    key_id: int,
    identity: AuthIdentity = Depends(validate_token_or_api_key),
    db: Session = Depends(get_db),
):
    """
    Revoke a key immediately. Revocation is enforced at lookup time in
    auth._validate_api_key_token (it filters on revoked_at IS NULL), so the
    very next request using this key is rejected — no caching/TTL delay.
    """
    user_id = _require_user_id(identity)
    row = (
        db.query(models.ApiKey)
        .filter(models.ApiKey.id == key_id, models.ApiKey.user_id == user_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API key not found")
    if row.revoked_at is None:
        row.revoked_at = datetime.utcnow()
        db.commit()
    return None


# ---------------------------------------------------------------------------
# Webhook subscriptions
# ---------------------------------------------------------------------------

VALID_EVENT_TYPES = {"analysis.completed"}


class WebhookCreateRequest(BaseModel):
    url: str = Field(..., min_length=1, max_length=2000)
    event_type: str

    @field_validator("event_type")
    @classmethod
    def event_type_must_be_known(cls, value: str) -> str:
        if value not in VALID_EVENT_TYPES:
            raise ValueError(f"Unknown event_type. Must be one of: {', '.join(sorted(VALID_EVENT_TYPES))}")
        return value

    @field_validator("url")
    @classmethod
    def url_must_be_https(cls, value: str) -> str:
        if not value.startswith("https://"):
            raise ValueError("Webhook url must use https://")
        return value


class WebhookResponse(BaseModel):
    id: int
    url: str
    event_type: str
    secret: str  # only returned on creation, same pattern as api key
    created_at: datetime


class WebhookListItem(BaseModel):
    id: int
    url: str
    event_type: str
    created_at: datetime


@router.post("/webhooks", response_model=WebhookResponse, status_code=status.HTTP_201_CREATED)
async def create_webhook(
    request: WebhookCreateRequest,
    identity: AuthIdentity = Depends(validate_token_or_api_key),
    db: Session = Depends(get_db),
):
    user_id = _require_user_id(identity)

    secret = generate_api_key()  # same token_urlsafe generator, reused as a signing secret
    row = models.WebhookSubscription(
        user_id=user_id,
        url=request.url,
        event_type=request.event_type,
        secret=secret,
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    return WebhookResponse(
        id=row.id,
        url=row.url,
        event_type=row.event_type,
        secret=secret,
        created_at=row.created_at,
    )


@router.get("/webhooks", response_model=List[WebhookListItem])
async def list_webhooks(
    identity: AuthIdentity = Depends(validate_token_or_api_key),
    db: Session = Depends(get_db),
):
    user_id = _require_user_id(identity)
    rows = (
        db.query(models.WebhookSubscription)
        .filter(models.WebhookSubscription.user_id == user_id)
        .order_by(models.WebhookSubscription.created_at.desc())
        .all()
    )
    return [
        WebhookListItem(id=r.id, url=r.url, event_type=r.event_type, created_at=r.created_at)
        for r in rows
    ]


@router.delete("/webhooks/{webhook_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_webhook(
    webhook_id: int,
    identity: AuthIdentity = Depends(validate_token_or_api_key),
    db: Session = Depends(get_db),
):
    user_id = _require_user_id(identity)
    row = (
        db.query(models.WebhookSubscription)
        .filter(models.WebhookSubscription.id == webhook_id, models.WebhookSubscription.user_id == user_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Webhook not found")
    db.delete(row)
    db.commit()
    return None