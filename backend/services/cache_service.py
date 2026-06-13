import logging
from typing import Optional
from sentence_transformers import SentenceTransformer, util
import torch

logger = logging.getLogger(__name__)

class SemanticCache:
    def __init__(self, threshold: float = 0.95):
        self.threshold = threshold
        self.cache = []  # List of dicts: {"query": str, "embedding": Tensor, "response": str}
        try:
            self.model = SentenceTransformer("all-MiniLM-L6-v2")
            logger.info("Semantic Cache initialized successfully.")
        except Exception as e:
            logger.error(f"Failed to initialize Semantic Cache: {e}")
            self.model = None

    def get(self, query: str) -> Optional[str]:
        if not self.model or not self.cache:
            return None

        query_emb = self.model.encode(query, convert_to_tensor=True)
        
        # Calculate similarities
        embeddings = torch.stack([item["embedding"] for item in self.cache])
        cos_scores = util.cos_sim(query_emb, embeddings)[0]
        
        best_score, best_idx = torch.max(cos_scores, dim=0)
        if best_score.item() >= self.threshold:
            logger.info(f"Semantic cache hit (score: {best_score.item():.2f}) for query: '{query}'")
            return self.cache[best_idx]["response"]
            
        return None

    def set(self, query: str, response: str):
        if not self.model:
            return
            
        embedding = self.model.encode(query, convert_to_tensor=True)
        self.cache.append({
            "query": query,
            "embedding": embedding,
            "response": response
        })
        logger.info(f"Added new query to semantic cache (total: {len(self.cache)})")

semantic_cache = SemanticCache()
