import logging
from collections import OrderedDict
from typing import Optional
from sentence_transformers import SentenceTransformer, util
import torch

logger = logging.getLogger(__name__)


# Maximum cached responses retained per identity. Bounded so a single
# high-traffic user cannot grow the process footprint without limit.
DEFAULT_MAX_ENTRIES_PER_NAMESPACE = 128


class _NamespaceCache:
    """Per-identity slot: an LRU-bounded list of embeddings and responses.

    The embedding matrix is materialized once and rebuilt only when the
    entry list changes (insert/evict), not on every ``get`` — the old
    implementation stacked a fresh tensor every request.
    """

    def __init__(self, max_entries: int):
        self.max_entries = max_entries
        # Maps query -> {"embedding": Tensor[384], "response": str}
        self.entries: "OrderedDict[str, dict]" = OrderedDict()
        self._matrix: Optional[torch.Tensor] = None
        self._matrix_keys: list[str] = []

    def _rebuild_matrix(self) -> None:
        if not self.entries:
            self._matrix = None
            self._matrix_keys = []
            return
        self._matrix_keys = list(self.entries.keys())
        self._matrix = torch.stack(
            [self.entries[k]["embedding"] for k in self._matrix_keys]
        )

    def get(self, query_emb: torch.Tensor, threshold: float) -> Optional[str]:
        if self._matrix is None or not self._matrix_keys:
            return None
        cos_scores = util.cos_sim(query_emb, self._matrix)[0]
        best_score, best_idx = torch.max(cos_scores, dim=0)
        if best_score.item() < threshold:
            return None
        hit_key = self._matrix_keys[int(best_idx.item())]
        entry = self.entries.get(hit_key)
        if entry is None:
            return None
        # Refresh LRU position on hit.
        self.entries.move_to_end(hit_key)
        return entry["response"]

    def set(self, query: str, embedding: torch.Tensor, response: str) -> None:
        if query in self.entries:
            self.entries[query]["response"] = response
            self.entries[query]["embedding"] = embedding
            self.entries.move_to_end(query)
        else:
            self.entries[query] = {"embedding": embedding, "response": response}
            while len(self.entries) > self.max_entries:
                self.entries.popitem(last=False)
        self._rebuild_matrix()


class SemanticCache:
    def __init__(
        self,
        threshold: float = 0.95,
        max_entries_per_namespace: int = DEFAULT_MAX_ENTRIES_PER_NAMESPACE,
    ):
        self.threshold = threshold
        self.max_entries_per_namespace = max_entries_per_namespace
        self._namespaces: dict[str, _NamespaceCache] = {}
        try:
            self.model = SentenceTransformer("all-MiniLM-L6-v2")
            logger.info("Semantic Cache initialized successfully.")
        except Exception as e:
            logger.error(f"Failed to initialize Semantic Cache: {e}")
            self.model = None

    def _get_namespace(self, namespace: str, *, create: bool) -> Optional[_NamespaceCache]:
        ns = self._namespaces.get(namespace)
        if ns is None and create:
            ns = _NamespaceCache(self.max_entries_per_namespace)
            self._namespaces[namespace] = ns
        return ns

    def get(self, query: str, namespace: str) -> Optional[str]:
        if not self.model or not namespace:
            return None
        ns = self._get_namespace(namespace, create=False)
        if ns is None:
            return None
        query_emb = self.model.encode(query, convert_to_tensor=True)
        hit = ns.get(query_emb, self.threshold)
        if hit is not None:
            logger.info(
                f"Semantic cache hit for namespace={namespace!r} query={query!r}"
            )
        return hit

    def set(self, query: str, response: str, namespace: str) -> None:
        if not self.model or not namespace:
            return
        ns = self._get_namespace(namespace, create=True)
        assert ns is not None
        embedding = self.model.encode(query, convert_to_tensor=True)
        ns.set(query, embedding, response)
        logger.info(
            f"Cached response for namespace={namespace!r} "
            f"(namespace total: {len(ns.entries)})"
        )


semantic_cache = SemanticCache()
