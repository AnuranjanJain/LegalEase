"""
Webhook dispatch service.

Fires signed HMAC-SHA256 webhook POSTs for subscribed events (e.g.
'analysis.completed'). Delivery is best-effort: a failure here must never
break the calling request, so every entry point swallows and logs
exceptions rather than raising.
"""
import hashlib
import hmac
import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict

import httpx
from sqlalchemy.orm import Session
from backend.core.network_safety import assert_safe_webhook_url, UnsafeUrlError

from backend import models

logger = logging.getLogger(__name__)

WEBHOOK_TIMEOUT_SECONDS = 5.0


def _sign_payload(secret: str, body: bytes) -> str:
    """HMAC-SHA256 signature of the raw request body, hex-encoded."""
    return hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()


async def fire_webhook(db: Session, user_id: int, event_type: str, payload: Dict[str, Any]) -> None:
    """
    Look up all active subscriptions for (user_id, event_type) and deliver
    a signed POST to each. Runs sequentially since webhook fan-out per user
    is expected to be small; failures are isolated per-subscription so one
    dead endpoint doesn't block delivery to the others.
    """
    subscriptions = (
        db.query(models.WebhookSubscription)
        .filter(
            models.WebhookSubscription.user_id == user_id,
            models.WebhookSubscription.event_type == event_type,
        )
        .all()
    )
    if not subscriptions:
        return

    envelope = {
        "event": event_type,
        "fired_at": datetime.now(timezone.utc).replace(tzinfo=None).isoformat() + "Z",
        "data": payload,
    }
    body = json.dumps(envelope, default=str).encode("utf-8")

    async with httpx.AsyncClient(timeout=WEBHOOK_TIMEOUT_SECONDS) as client:
        for sub in subscriptions:
            # Re-validate immediately before delivery, not just at
            # subscription creation time. A hostname that resolved to a
            # public IP when the webhook was created can be repointed at
            # an internal address later (DNS rebinding) if the attacker
            # controls that hostname's DNS records.
            try:
                assert_safe_webhook_url(sub.url)
            except UnsafeUrlError:
                logger.warning(
                    "Skipping webhook delivery to subscription %s: url no longer resolves to a safe address",
                    sub.id, exc_info=True,
                )
                continue

            signature = _sign_payload(sub.secret, body)
            try:
                response = await client.post(
                    sub.url,
                    content=body,
                    headers={
                        "Content-Type": "application/json",
                        "X-Webhook-Signature": signature,
                        "X-Webhook-Event": event_type,
                    },
                )
                if response.status_code >= 400:
                    logger.warning(
                        "Webhook delivery to subscription %s returned status %s",
                        sub.id, response.status_code,
                    )
            except Exception:
                # Best-effort delivery: a dead/unreachable endpoint should
                # never surface as an error to the user whose action
                # triggered the event.
                logger.warning(
                    "Webhook delivery to subscription %s failed", sub.id, exc_info=True
                )