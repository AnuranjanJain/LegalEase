import logging
from typing import List, Dict, Any

try:
    from rank_bm25 import BM25Okapi
except Exception:
    BM25Okapi = None

try:
    import numpy as np
except Exception:
    np = None

logger = logging.getLogger(__name__)

# Load a lightweight sentence transformer (we lazy load to speed up startup)
_model = None
_model_import_attempted = False

def get_model():
    global _model, _model_import_attempted
    if _model is not None or _model_import_attempted:
        return _model
    _model_import_attempted = True
    try:
        from sentence_transformers import SentenceTransformer
    except Exception as exc:
        logger.warning("Dense hybrid search disabled (%s)", type(exc).__name__)
        return None

    try:
        # Load a small fast model for embeddings
        _model = SentenceTransformer('all-MiniLM-L6-v2')
    except Exception as exc:
        logger.warning("Dense hybrid search model unavailable (%s)", type(exc).__name__)
    return _model

def get_hybrid_results(query: str, documents: List[str], top_k: int = 3) -> List[Dict[str, Any]]:
    """
    Perform Hybrid Search (BM25 + Dense Vector) on a list of document texts.
    Returns ranked results combining keyword matching and semantic similarity.
    """
    if not query or not documents:
        return []

    try:
        # 1. BM25 (Sparse) Search
        if BM25Okapi is None:
            return []
        tokenized_corpus = [doc.lower().split(" ") for doc in documents]
        bm25 = BM25Okapi(tokenized_corpus)
        tokenized_query = query.lower().split(" ")
        bm25_scores = bm25.get_scores(tokenized_query)
        
        # Normalize BM25 scores
        max_bm25 = max(bm25_scores) if max(bm25_scores) > 0 else 1.0
        norm_bm25 = [score / max_bm25 for score in bm25_scores]

        # 2. Dense Vector Search
        model = get_model()
        if model is None or np is None:
            return [
                {"content": documents[idx], "score": float(norm_bm25[idx]),
                 "bm25_score": float(norm_bm25[idx]), "dense_score": 0.0}
                for idx in sorted(range(len(documents)), key=lambda i: norm_bm25[i], reverse=True)[:top_k]
            ]
        query_emb = model.encode(query, normalize_embeddings=True)
        doc_embs = model.encode(documents, normalize_embeddings=True)
        
        # Calculate cosine similarities
        cosine_scores = np.dot(doc_embs, query_emb)
        # Normalize dense scores (already between -1 and 1, shift/scale to 0-1)
        norm_dense = [(score + 1) / 2 for score in cosine_scores]

        # 3. Reciprocal Rank Fusion / Weighted Combination
        alpha = 0.5  # Weight for BM25 vs Dense
        final_scores = [
            (alpha * bm25_score) + ((1 - alpha) * dense_score)
            for bm25_score, dense_score in zip(norm_bm25, norm_dense)
        ]

        # 4. Rank and format results
        ranked_indices = np.argsort(final_scores)[::-1][:top_k]
        
        results = []
        for idx in ranked_indices:
            results.append({
                "content": documents[idx],
                "score": float(final_scores[idx]),
                "bm25_score": float(norm_bm25[idx]),
                "dense_score": float(norm_dense[idx])
            })
            
        return results

    except Exception as e:
        logger.error(f"Hybrid search failed: {e}")
        return []
    
def embed_text(text: str) -> List[float]:
    """
    Compute a dense embedding for a single piece of text and return it as a
    plain Python list, so callers can JSON-serialize it for storage (e.g. in
    SavedClause.embedding) without depending on numpy at the call site.
    """
    model = get_model()
    if model is None:
        return []
    return model.encode(text, normalize_embeddings=True).tolist()


def search_saved_clauses(query: str, clauses: List[Dict[str, Any]], top_k: int = 5) -> List[Dict[str, Any]]:
    """
    Semantic + keyword search over a user's persisted SavedClause rows.
    Reuses embeddings computed once at save-time instead of re-encoding
    the whole corpus on every search.

    `clauses` is a list of dicts shaped like:
        {"id": int, "content": str, "embedding": List[float]}
    """
    if not query or not clauses:
        return []

    try:
        contents = [c["content"] for c in clauses]

        if BM25Okapi is None:
            return []
        tokenized_corpus = [c.lower().split(" ") for c in contents]
        bm25 = BM25Okapi(tokenized_corpus)
        tokenized_query = query.lower().split(" ")
        bm25_scores = bm25.get_scores(tokenized_query)
        max_bm25 = max(bm25_scores) if max(bm25_scores) > 0 else 1.0
        norm_bm25 = [score / max_bm25 for score in bm25_scores]

        model = get_model()
        if model is None or np is None:
            ranked_indices = sorted(range(len(clauses)), key=lambda i: norm_bm25[i], reverse=True)[:top_k]
            return [
                {
                    "id": clauses[idx]["id"],
                    "content": clauses[idx]["content"],
                    "score": float(norm_bm25[idx]),
                    "bm25_score": float(norm_bm25[idx]),
                    "dense_score": 0.0,
                }
                for idx in ranked_indices
            ]
        query_emb = model.encode(query, normalize_embeddings=True)
        doc_embs = np.array([c["embedding"] for c in clauses])
        cosine_scores = np.dot(doc_embs, query_emb)
        norm_dense = [(score + 1) / 2 for score in cosine_scores]

        alpha = 0.5
        final_scores = [
            (alpha * b) + ((1 - alpha) * d)
            for b, d in zip(norm_bm25, norm_dense)
        ]

        ranked_indices = np.argsort(final_scores)[::-1][:top_k]

        results = []
        for idx in ranked_indices:
            results.append({
                "id": clauses[idx]["id"],
                "content": clauses[idx]["content"],
                "score": float(final_scores[idx]),
                "bm25_score": float(norm_bm25[idx]),
                "dense_score": float(norm_dense[idx]),
            })

        return results

    except Exception as e:
        logger.error(f"Saved clause search failed: {e}")
        return []
