import logging
from typing import List, Dict, Any
try:
    # Optional dependency: CI/build may install without this module.
    from duckduckgo_search import DDGS  # type: ignore
except Exception:  # pragma: no cover
    DDGS = None  # type: ignore

logger = logging.getLogger(__name__)



def perform_web_search(query: str, max_results: int = 5) -> List[Dict[str, Any]]:
    """
    Perform a live web search using DuckDuckGo to augment legal context.
    """
    if not query:
        return []

    if DDGS is None:
        logger.warning("duckduckgo_search is not installed; skipping live web search")
        return []

    try:
        results = []
        with DDGS() as ddgs:
            for r in ddgs.text(query, max_results=max_results):
                results.append({
                    "title": r.get("title", ""),
                    "snippet": r.get("body", ""),
                    "url": r.get("href", "")
                })
        return results
    except Exception as e:
        logger.error(f"Web search failed for query '{query}': {e}")
        return []
