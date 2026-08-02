"""
Tests for backend.services.cache_service.

Covers the namespace-eviction bug fix: SemanticCache._namespaces
previously grew without bound, one entry per distinct caller identity
ever seen. It should now be LRU-bounded by max_namespaces, evicting the
least-recently-used identity once the cap is exceeded.

The real SentenceTransformer model is not loaded in these tests — it's
slow and needs network/disk access to a model cache. Instead, the model
attribute is monkeypatched with a lightweight fake that returns
deterministic embeddings, so these tests exercise the real eviction
logic without the ML dependency.
"""

import torch
import pytest

from backend.services.cache_service import SemanticCache, _NamespaceCache


class FakeModel:
    """
    Deterministic stand-in for SentenceTransformer.encode(). Maps each
    distinct query string to its own orthogonal-ish embedding so cache
    hits/misses in these tests are predictable rather than depending on
    real semantic similarity.
    """

    def __init__(self):
        self._known: dict[str, torch.Tensor] = {}
        self._dim = 8

    def encode(self, text: str, convert_to_tensor: bool = True) -> torch.Tensor:
        if text not in self._known:
            # Simple deterministic embedding: one-hot-ish based on a hash
            # of the text, so different strings reliably produce distinct,
            # low-similarity vectors.
            vec = torch.zeros(self._dim)
            vec[hash(text) % self._dim] = 1.0
            self._known[text] = vec
        return self._known[text]


@pytest.fixture()
def cache():
    """A SemanticCache with a fake model and a small max_namespaces cap
    (3) so eviction is easy to trigger in a handful of calls."""
    c = SemanticCache(threshold=0.95, max_entries_per_namespace=128, max_namespaces=3)
    c.model = FakeModel()
    return c


class TestNamespaceEviction:
    def test_namespace_count_does_not_exceed_cap(self, cache):
        for i in range(10):
            cache.set(f"query-{i}", f"response-{i}", namespace=f"user:{i}@example.com")

        assert len(cache._namespaces) <= cache.max_namespaces

    def test_least_recently_used_namespace_is_evicted_first(self, cache):
        # Fill exactly to the cap (3): user:0, user:1, user:2
        cache.set("q0", "r0", namespace="user:0")
        cache.set("q1", "r1", namespace="user:1")
        cache.set("q2", "r2", namespace="user:2")
        assert set(cache._namespaces.keys()) == {"user:0", "user:1", "user:2"}

        # Adding a 4th namespace must evict the least-recently-used one
        # (user:0, since it hasn't been touched since creation).
        cache.set("q3", "r3", namespace="user:3")

        assert "user:0" not in cache._namespaces
        assert set(cache._namespaces.keys()) == {"user:1", "user:2", "user:3"}

    def test_accessing_a_namespace_via_get_marks_it_recently_used(self, cache):
        cache.set("q0", "r0", namespace="user:0")
        cache.set("q1", "r1", namespace="user:1")
        cache.set("q2", "r2", namespace="user:2")

        # Touch user:0 via get() — this should move it to "recently used",
        # so it survives the next eviction instead of user:1.
        cache.get("q0", namespace="user:0")

        cache.set("q3", "r3", namespace="user:3")

        assert "user:0" in cache._namespaces, "recently-accessed namespace should not be evicted"
        assert "user:1" not in cache._namespaces, "least-recently-used namespace should be evicted instead"

    def test_evicted_namespace_data_is_actually_gone(self, cache):
        cache.set("q0", "r0", namespace="user:0")
        cache.set("q1", "r1", namespace="user:1")
        cache.set("q2", "r2", namespace="user:2")
        cache.set("q3", "r3", namespace="user:3")  # evicts user:0

        # A subsequent get() on the evicted namespace must be a clean miss
        # (a fresh, empty namespace may be created on next set(), but the
        # old cached response must not resurrect).
        result = cache.get("q0", namespace="user:0")
        assert result is None

    def test_namespace_cap_holds_across_many_distinct_identities(self, cache):
        """
        Simulates the original bug's scenario: many distinct
        users/API-keys hitting the cache over a long process lifetime.
        Namespace count must stay bounded throughout, not just at the end.
        """
        max_seen = 0
        for i in range(200):
            cache.set(f"query", f"response-{i}", namespace=f"identity:{i}")
            max_seen = max(max_seen, len(cache._namespaces))

        assert max_seen <= cache.max_namespaces
        assert len(cache._namespaces) <= cache.max_namespaces

    def test_within_namespace_entry_cap_still_works_independently(self, cache):
        """
        Regression guard: the existing per-namespace entry LRU (128 cap)
        must still function correctly alongside the new namespace-level
        LRU — the two caps are independent of each other.
        """
        namespace = "user:heavy-user@example.com"
        for i in range(150):
            cache.set(f"query-{i}", f"response-{i}", namespace=namespace)

        ns = cache._namespaces[namespace]
        assert len(ns.entries) <= cache.max_entries_per_namespace


class TestBasicGetSetStillWork:
    """Sanity checks that the eviction changes didn't break normal operation."""

    def test_set_then_get_same_namespace_returns_cached_response(self, cache):
        cache.set("what is the termination clause", "It's in section 5.", namespace="user:a")
        result = cache.get("what is the termination clause", namespace="user:a")
        assert result == "It's in section 5."

    def test_get_on_unknown_namespace_returns_none(self, cache):
        assert cache.get("anything", namespace="never-seen-before") is None

    def test_empty_namespace_string_is_a_no_op(self, cache):
        cache.set("query", "response", namespace="")
        assert cache.get("query", namespace="") is None
        assert "" not in cache._namespaces