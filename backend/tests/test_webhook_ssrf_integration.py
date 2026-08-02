"""
Integration tests confirming the SSRF guard is actually wired into both
webhook subscription creation and webhook delivery, not just the standalone
network_safety unit.
"""

import socket

import pytest
from pydantic import ValidationError

from backend.routers.developer_routes import WebhookCreateRequest


def _fake_addrinfo(ip: str):
    return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (ip, 0))]


class TestWebhookCreateRequestValidation:
    def test_rejects_metadata_endpoint_at_creation(self, monkeypatch):
        monkeypatch.setattr(
            socket, "getaddrinfo", lambda host, port: _fake_addrinfo("169.254.169.254")
        )
        with pytest.raises(ValidationError):
            WebhookCreateRequest(
                url="https://169.254.169.254/latest/meta-data/",
                event_type="analysis.completed",
            )

    def test_accepts_public_url_at_creation(self, monkeypatch):
        monkeypatch.setattr(
            socket, "getaddrinfo", lambda host, port: _fake_addrinfo("93.184.216.34")
        )
        request = WebhookCreateRequest(
            url="https://example.com/webhooks/receive",
            event_type="analysis.completed",
        )
        assert request.url == "https://example.com/webhooks/receive"


class TestFireWebhookDeliverySkipsUnsafeUrls:
    @pytest.mark.asyncio
    async def test_skips_delivery_when_url_no_longer_resolves_safely(self, monkeypatch):
        """
        DNS rebinding scenario: a subscription whose url now resolves to an
        internal address (even though it may have been public at creation
        time) must be skipped at delivery, not posted to.
        """
        from backend.services import webhooks as webhooks_module
        from backend import models

        class FakeSubscription:
            id = 1
            url = "https://rebound.example/hook"
            secret = "test-secret"

        class FakeQuery:
            def filter(self, *args, **kwargs):
                return self
            def all(self):
                return [FakeSubscription()]

        class FakeDb:
            def query(self, *args, **kwargs):
                return FakeQuery()

        monkeypatch.setattr(
            socket, "getaddrinfo", lambda host, port: _fake_addrinfo("10.0.0.5")
        )

        post_called = False

        class FakeAsyncClient:
            def __init__(self, *args, **kwargs):
                pass
            async def __aenter__(self):
                return self
            async def __aexit__(self, *args):
                return False
            async def post(self, *args, **kwargs):
                nonlocal post_called
                post_called = True

        monkeypatch.setattr(webhooks_module.httpx, "AsyncClient", FakeAsyncClient)

        await webhooks_module.fire_webhook(
            db=FakeDb(), user_id=1, event_type="analysis.completed", payload={"foo": "bar"}
        )

        assert post_called is False, "must not POST to a url that resolves to a private address"