import logging
from collections import OrderedDict
from typing import Optional, Any
import threading

logger = logging.getLogger(__name__)

# These optional ML dependencies are deliberately imported on first cache use.
# Importing SentenceTransformer at module load can download a model or fail on
# serverless runtimes, which would prevent unrelated auth endpoints from
# starting.
_torch = None
_torch_import_attempted = False
_sentence_transformer = None
_sentence_transformer_import_attempted = False


def _load_torch():
    global _torch, _torch_import_attempted
    if _torch_import_attempted:
        return _torch
    _torch_import_attempted = True
    try:
        import torch
        _torch = torch
    except Exception as exc:
        logger.warning("Semantic cache disabled: PyTorch is unavailable (%s)", type(exc).__name__)
    return _torch


def _load_sentence_transformer():
    global _sentence_transformer, _sentence_transformer_import_attempted
    if _sentence_transformer_import_attempted:
        return _sentence_transformer
    _sentence_transformer_import_attempted = True
    try:
        from sentence_transformers import SentenceTransformer, util
        _sentence_transformer = (SentenceTransformer, util)
    except Exception as exc:
        logger.warning(
            "Semantic cache disabled: sentence-transformers is unavailable (%s)",
            type(exc).__name__,
        )
    return _sentence_transformer


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
        self._matrix: Optional[Any] = None
        self._matrix_keys: list[str] = []

    def _rebuild_matrix(self) -> None:
        torch = _load_torch()
        if not self.entries or torch is None:
            self._matrix = None
            self._matrix_keys = []
            return
        self._matrix_keys = list(self.entries.keys())
        self._matrix = torch.stack(
            [self.entries[k]["embedding"] for k in self._matrix_keys]
        )

    def get(self, query_emb: Any, threshold: float) -> Optional[str]:
        torch = _load_torch()
        if self._matrix is None or not self._matrix_keys or torch is None:
            return None
        cos_scores = torch.nn.functional.cosine_similarity(
            query_emb.unsqueeze(0), self._matrix
        )
        best_score, best_idx = torch.max(cos_scores, dim=0)
        if best_score.item() < threshold:
            return None
        hit_key = self._matrix_keys[int(best_idx.item())]
        entry = self.entries.get(hit_key)
        if entry is None:
            return None
        # Move hit query to end for intra-namespace LRU behavior
        self.entries.move_to_end(hit_key)
        return entry["response"]

    def set(self, query: str, embedding: Any, response: str) -> None:
        if query in self.entries:
            self.entries[query]["response"] = response
            self.entries[query]["embedding"] = embedding
            self.entries.move_to_end(query)
        else:
            self.entries[query] = {"embedding": embedding, "response": response}
            while len(self.entries) > self.max_entries:
                self.entries.popitem(last=False)
        self._rebuild_matrix()


# Maximum distinct caller identities (namespaces) retained at once. Bounds
# total process memory regardless of how many distinct users/API keys the
# process serves over its lifetime — without this, _namespaces grew
# forever, one entry per identity ever seen, each holding up to
# max_entries_per_namespace embedding tensors.
DEFAULT_MAX_NAMESPACES = 500


class SemanticCache:
    def __init__(
        self,
        threshold: float = 0.95,
        max_entries_per_namespace: int = DEFAULT_MAX_ENTRIES_PER_NAMESPACE,
        max_namespaces: int = DEFAULT_MAX_NAMESPACES,
    ):
        self.threshold = threshold
        self.max_entries_per_namespace = max_entries_per_namespace
        self.max_namespaces = max_namespaces
        # LRU-bounded by namespace, same pattern _NamespaceCache already
        # uses to LRU-bound entries within a namespace. move_to_end() on
        # every access keeps recently-active identities at the "new" end;
        # popitem(last=False) evicts the least-recently-used identity once
        # the cap is exceeded.
        self._namespaces: "OrderedDict[str, _NamespaceCache]" = OrderedDict()
        self.model = None
        self._model_lock = threading.Lock()
        self._model_load_attempted = False

    def _get_model(self):
        """Load the embedding model only when a cache operation needs it."""
        if self.model is not None or self._model_load_attempted:
            return self.model

        with self._model_lock:
            if self.model is not None or self._model_load_attempted:
                return self.model
            self._model_load_attempted = True
            dependency = _load_sentence_transformer()
            if dependency is None:
                return None
            sentence_transformer, _ = dependency
            try:
                self.model = sentence_transformer("all-MiniLM-L6-v2")
                logger.info("Semantic Cache initialized successfully.")
            except Exception as exc:
                logger.warning(
                    "Semantic cache model could not be loaded; continuing without cache (%s)",
                    type(exc).__name__,
                )
            return self.model

    def _get_namespace(self, namespace: str, *, create: bool) -> Optional[_NamespaceCache]:
        ns = self._namespaces.get(namespace)
        if ns is not None:
            self._namespaces.move_to_end(namespace)
            return ns
        if not create:
            return None

        ns = _NamespaceCache(self.max_entries_per_namespace)
        self._namespaces[namespace] = ns
        while len(self._namespaces) > self.max_namespaces:
            evicted_key, _ = self._namespaces.popitem(last=False)
            logger.info(
                f"Evicted least-recently-used cache namespace={evicted_key!r} "
                f"(namespace cap: {self.max_namespaces})"
            )
        return ns

    def get(self, query: str, namespace: str) -> Optional[str]:
        model = self._get_model()
        if not model or not namespace:
            return None
        ns = self._get_namespace(namespace, create=False)
        if ns is None:
            return None
        query_emb = model.encode(query, convert_to_tensor=True)
        hit = ns.get(query_emb, self.threshold)
        if hit is not None:
            logger.info(
                f"Semantic cache hit for namespace={namespace!r} query={query!r}"
            )
        return hit

    def set(self, query: str, response: str, namespace: str) -> None:
        model = self._get_model()
        if not model or not namespace:
            return
        ns = self._get_namespace(namespace, create=True)
        assert ns is not None
        embedding = model.encode(query, convert_to_tensor=True)
        ns.set(query, embedding, response)
        logger.info(
            f"Cached response for namespace={namespace!r} "
            f"(namespace total: {len(ns.entries)})"
        )


semantic_cache = SemanticCache()
