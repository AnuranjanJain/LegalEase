"""
Tests for backend.core.network_safety — the SSRF guard used by webhook
subscriptions. socket.getaddrinfo is monkeypatched throughout so these
tests are deterministic and don't depend on real DNS resolution.
"""

import socket

import pytest

from backend.core.network_safety import assert_safe_webhook_url, UnsafeUrlError


def _fake_addrinfo(ip: str):
    """Build a minimal getaddrinfo()-shaped return value for a single IP."""
    return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (ip, 0))]


class TestAssertSafeWebhookUrl:
    def test_rejects_non_https_scheme(self):
        with pytest.raises(UnsafeUrlError, match="https"):
            assert_safe_webhook_url("http://example.com/hook")

    def test_rejects_url_with_no_hostname(self):
        with pytest.raises(UnsafeUrlError, match="hostname"):
            assert_safe_webhook_url("https:///path-only")

    def test_rejects_loopback_address(self, monkeypatch):
        monkeypatch.setattr(
            socket, "getaddrinfo", lambda host, port: _fake_addrinfo("127.0.0.1")
        )
        with pytest.raises(UnsafeUrlError):
            assert_safe_webhook_url("https://localhost/hook")

    def test_rejects_cloud_metadata_address(self, monkeypatch):
        monkeypatch.setattr(
            socket, "getaddrinfo", lambda host, port: _fake_addrinfo("169.254.169.254")
        )
        with pytest.raises(UnsafeUrlError):
            assert_safe_webhook_url("https://metadata.internal/latest/meta-data/")

    def test_rejects_rfc1918_private_address(self, monkeypatch):
        for private_ip in ["10.0.0.5", "172.16.0.5", "192.168.1.5"]:
            monkeypatch.setattr(
                socket, "getaddrinfo", lambda host, port, ip=private_ip: _fake_addrinfo(ip)
            )
            with pytest.raises(UnsafeUrlError):
                assert_safe_webhook_url("https://internal-service.example/hook")

    def test_rejects_when_hostname_does_not_resolve(self, monkeypatch):
        def raise_gaierror(host, port):
            raise socket.gaierror("Name or service not known")

        monkeypatch.setattr(socket, "getaddrinfo", raise_gaierror)
        with pytest.raises(UnsafeUrlError, match="could not be resolved"):
            assert_safe_webhook_url("https://this-does-not-exist.invalid/hook")

    def test_allows_public_address(self, monkeypatch):
        monkeypatch.setattr(
            socket, "getaddrinfo", lambda host, port: _fake_addrinfo("93.184.216.34")
        )
        # Should not raise.
        assert_safe_webhook_url("https://example.com/webhooks/receive")

    def test_rejects_if_any_resolved_address_is_unsafe(self, monkeypatch):
        """
        A hostname resolving to multiple IPs (e.g. round-robin DNS) must be
        rejected if ANY of the addresses is unsafe, not just the first one
        returned.
        """
        def multi_addrinfo(host, port):
            return [
                (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 0)),
                (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("127.0.0.1", 0)),
            ]

        monkeypatch.setattr(socket, "getaddrinfo", multi_addrinfo)
        with pytest.raises(UnsafeUrlError):
            assert_safe_webhook_url("https://mixed-resolution.example/hook")