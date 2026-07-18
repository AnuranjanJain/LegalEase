"""
signature_routes.py
────────────────────
E-signature / approval workflow.

Endpoints:
  - POST /documents/{id}/signature-requests   (JWT/API-key auth)
    Define signer order and generate a unique, tokenized signing link
    per signer.
  - GET  /sign/{token}                        (public, token-authenticated)
    A signer views the document using only their unique token — no
    account or JWT required.
  - POST /sign/{token}                        (public, token-authenticated)
    Capture a signature + timestamp + IP, enforce signing order, and once
    every signatory has signed, lock the document and make a completion
    PDF available via /documents/{id}/signed-copy.
  - GET  /documents/{id}/signature-audit-trail (JWT/API-key auth)
    Full audit trail (who signed, when, from what IP) for a document.
  - GET  /documents/{id}/signed-copy          (JWT/API-key auth)
    Download the completion PDF once a document is fully signed.

Security notes:
  - Authenticated endpoints reuse the same validate_token_or_api_key +
    per-user ownership check pattern already used throughout the app
    (see legal_routes.py, comments_routes.py).
  - Signer-facing endpoints are intentionally token-only, not JWT: the
    signer is often an external party with no account. The token is a
    high-entropy secrets.token_urlsafe value (see core/encryption.py),
    not a sequential or guessable id.
  - Signing order is enforced server-side on every submit_signature call,
    not just trusted from the client.
"""

import logging
from datetime import datetime
from io import BytesIO
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from backend.auth import validate_token_or_api_key, AuthIdentity
from backend.database import get_db
from backend import models
from backend.core.encryption import generate_secure_token
from backend.core.validation import sanitize_text
from backend.services.pdf_service import generate_pdf

logger = logging.getLogger(__name__)

router = APIRouter(tags=["signatures"])


# ---------------------------------------------------------------------------
# Request / response schemas
# ---------------------------------------------------------------------------

class SignatoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    email: EmailStr


class CreateSignatureRequestPayload(BaseModel):
    signatories: List[SignatoryCreate] = Field(..., min_length=1, max_length=20)


class SignatoryLinkItem(BaseModel):
    signatory_id: int
    name: str
    order_index: int
    signing_token: str


class CreateSignatureRequestResponse(BaseModel):
    signature_request_id: int
    status: str
    signatories: List[SignatoryLinkItem]


class SignDocumentView(BaseModel):
    document_id: int
    filename: str
    document_text: Optional[str] = None
    signatory_name: str
    order_index: int
    is_your_turn: bool
    already_signed: bool


class SubmitSignaturePayload(BaseModel):
    typed_name: str = Field(..., min_length=1, max_length=200)


class SubmitSignatureResponse(BaseModel):
    status: str
    document_locked: bool


class AuditTrailEntry(BaseModel):
    signatory_name: str
    order_index: int
    status: str
    signed_at: Optional[datetime] = None
    ip_address: Optional[str] = None


class AuditTrailResponse(BaseModel):
    document_id: int
    signature_request_status: str
    entries: List[AuditTrailEntry]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_owned_document(document_id: int, user_id: int, db: Session) -> models.DocumentRecord:
    doc = (
        db.query(models.DocumentRecord)
        .filter(
            models.DocumentRecord.id == document_id,
            models.DocumentRecord.user_id == user_id,
        )
        .first()
    )
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return doc


def _get_signatory_or_404(token: str, db: Session) -> models.Signatory:
    signatory = db.query(models.Signatory).filter(models.Signatory.token == token).first()
    if not signatory:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid or expired signing link")
    return signatory


def _earlier_pending_exists(signatory: models.Signatory, db: Session) -> bool:
    """True if any signer earlier in order_index hasn't signed yet."""
    earlier = (
        db.query(models.Signatory)
        .filter(
            models.Signatory.signature_request_id == signatory.signature_request_id,
            models.Signatory.order_index < signatory.order_index,
            models.Signatory.status != "signed",
        )
        .first()
    )
    return earlier is not None


# ---------------------------------------------------------------------------
# Authenticated endpoints
# ---------------------------------------------------------------------------

@router.post("/documents/{document_id}/signature-requests", response_model=CreateSignatureRequestResponse)
async def create_signature_request(
    document_id: int,
    payload: CreateSignatureRequestPayload,
    identity: AuthIdentity = Depends(validate_token_or_api_key),
    db: Session = Depends(get_db),
):
    """Define signer order for a document and generate a unique signing link per signer."""
    user_id = identity.get_user_id()
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    doc = _get_owned_document(document_id, user_id, db)
    if doc.locked:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Document is already locked/signed")

    sig_request = models.SignatureRequest(
        document_id=document_id,
        initiator_id=user_id,
        status="pending",
    )
    db.add(sig_request)
    db.flush()  # populate sig_request.id before creating child Signatory rows

    created = []
    for idx, s in enumerate(payload.signatories):
        signatory = models.Signatory(
            signature_request_id=sig_request.id,
            name=sanitize_text(s.name),
            email=str(s.email),
            order_index=idx,
            status="pending",
            token=generate_secure_token(),
        )
        db.add(signatory)
        created.append(signatory)

    db.commit()
    for s in created:
        db.refresh(s)

    return CreateSignatureRequestResponse(
        signature_request_id=sig_request.id,
        status=sig_request.status,
        signatories=[
            SignatoryLinkItem(
                signatory_id=s.id,
                name=s.name,
                order_index=s.order_index,
                signing_token=s.token,
            )
            for s in created
        ],
    )


@router.get("/documents/{document_id}/signature-audit-trail", response_model=AuditTrailResponse)
async def get_audit_trail(
    document_id: int,
    identity: AuthIdentity = Depends(validate_token_or_api_key),
    db: Session = Depends(get_db),
):
    """Full audit trail (who signed, when, from what IP) for a document's most recent signature request."""
    user_id = identity.get_user_id()
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    _get_owned_document(document_id, user_id, db)

    sig_request = (
        db.query(models.SignatureRequest)
        .filter(models.SignatureRequest.document_id == document_id)
        .order_by(models.SignatureRequest.created_at.desc())
        .first()
    )
    if not sig_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No signature request found for this document",
        )

    entries = [
        AuditTrailEntry(
            signatory_name=s.name,
            order_index=s.order_index,
            status=s.status,
            signed_at=s.signed_at,
            ip_address=s.ip_address,
        )
        for s in sorted(sig_request.signatories, key=lambda s: s.order_index)
    ]

    return AuditTrailResponse(
        document_id=document_id,
        signature_request_status=sig_request.status,
        entries=entries,
    )


@router.get("/documents/{document_id}/signed-copy")
async def download_signed_copy(
    document_id: int,
    identity: AuthIdentity = Depends(validate_token_or_api_key),
    db: Session = Depends(get_db),
):
    """Download the completion PDF once a document has been fully signed."""
    user_id = identity.get_user_id()
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    doc = _get_owned_document(document_id, user_id, db)
    if not doc.locked:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Document has not been fully signed yet")

    pdf_bytes = generate_pdf(
        title=f"Signed Document: {doc.filename}",
        summary=doc.summary,
        chat_history=None,
    )

    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=signed_{doc.filename}.pdf"},
    )


# ---------------------------------------------------------------------------
# Public, token-authenticated endpoints (no JWT — signer has no account)
# ---------------------------------------------------------------------------

@router.get("/sign/{token}", response_model=SignDocumentView)
async def view_signing_request(token: str, db: Session = Depends(get_db)):
    """A signer views the document and their turn status using only their unique token."""
    signatory = _get_signatory_or_404(token, db)
    sig_request = signatory.signature_request
    doc = sig_request.document

    is_your_turn = signatory.status == "pending" and not _earlier_pending_exists(signatory, db)

    return SignDocumentView(
        document_id=doc.id,
        filename=doc.filename,
        document_text=doc.summary,
        signatory_name=signatory.name,
        order_index=signatory.order_index,
        is_your_turn=is_your_turn,
        already_signed=(signatory.status == "signed"),
    )


@router.post("/sign/{token}", response_model=SubmitSignatureResponse)
async def submit_signature(
    token: str,
    payload: SubmitSignaturePayload,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Capture a signature + timestamp + IP for this signer, enforce signing
    order server-side, and lock the document once every signatory is done.
    """
    signatory = _get_signatory_or_404(token, db)
    sig_request = signatory.signature_request

    if signatory.status == "signed":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This signature has already been submitted")

    if _earlier_pending_exists(signatory, db):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="It is not your turn to sign yet")

    client_ip = request.client.host if request.client else None

    signatory.status = "signed"
    signatory.signed_at = datetime.utcnow()
    signatory.ip_address = client_ip
    signatory.signature_image_or_typed_name = sanitize_text(payload.typed_name)
    db.commit()

    remaining = (
        db.query(models.Signatory)
        .filter(
            models.Signatory.signature_request_id == sig_request.id,
            models.Signatory.status != "signed",
        )
        .count()
    )

    document_locked = False
    if remaining == 0:
        sig_request.status = "completed"
        doc = sig_request.document
        doc.locked = 1
        db.commit()
        document_locked = True

    return SubmitSignatureResponse(status=signatory.status, document_locked=document_locked)