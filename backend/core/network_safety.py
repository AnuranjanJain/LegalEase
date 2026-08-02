"""
Guards against Server-Side Request Forgery (SSRF) for any feature that
makes outbound HTTP requests to a user-supplied URL (currently: webhook
subscriptions).

A URL passing "starts with https://" is not sufficient — that only rules
out plaintext http, not the server being tricked into calling itself, its
cloud metadata endpoint, or other internal-network services. This module
resolves the hostname and rejects it if any resolved address falls in a
private, loopback, link-local, or otherwise non-public range.

Resolution happens at TWO points, not just one:
  1. At webhook creation time (fast feedback to the user).
  2. Immediately before each delivery attempt (guards against DNS
     rebinding: a hostname that resolved to a public IP at creation time
     but has since been repointed at an internal IP by an attacker who
     controls that hostname's DNS).
"""

import ipaddress
import logging
import socket
from urllib.parse import urlparse

logger = logging.getLogger(__name__)


class UnsafeUrlError(ValueError):
    """Raised when a URL resolves to a disallowed (private/internal) address."""
    pass


def _is_unsafe_ip(ip_str: str) -> bool:
    """True if this address should never be reachable from server-initiated requests."""
    try:
        ip = ipaddress.ip_address(ip_str)
    except ValueError:
        return True  # unparsable — fail closed
    return (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_reserved
        or ip.is_multicast
        or ip.is_unspecified
    )


def assert_safe_webhook_url(url: str) -> None:
    """
    Raise UnsafeUrlError if `url` is not a safe target for a server-side
    outbound request. Safe means: https scheme, has a hostname, and every
    IP address that hostname currently resolves to is a public,
    non-internal address.
    """
    parsed = urlparse(url)

    if parsed.scheme != "https":
        raise UnsafeUrlError("Webhook url must use https://")

    hostname = parsed.hostname
    if not hostname:
        raise UnsafeUrlError("Webhook url must include a hostname")

    try:
        addr_infos = socket.getaddrinfo(hostname, None)
    except socket.gaierror as exc:
        raise UnsafeUrlError(f"Webhook url hostname could not be resolved: {exc}")

    resolved_ips = {info[4][0] for info in addr_infos}
    if not resolved_ips:
        raise UnsafeUrlError("Webhook url hostname resolved to no addresses")

    unsafe = [ip for ip in resolved_ips if _is_unsafe_ip(ip)]
    if unsafe:
        logger.warning(
            "Rejected webhook url %r: resolves to internal/private address(es) %s",
            url, unsafe,
        )
        raise UnsafeUrlError(
            "Webhook url resolves to a private, loopback, or internal network address"
        )