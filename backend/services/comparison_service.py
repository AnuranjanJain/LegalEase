"""
comparison_service.py
─────────────────────
Builds comparison-aware prompts and assembles multi-document context for the
LLM when the user requests cross-document analysis.

Design decisions:
  - Context assembly is pure (no I/O) so it is easy to unit-test.
  - The LLM call is delegated to ai_service to reuse retry / timeout logic.
  - Total context is capped at MAX_TOTAL_CONTEXT_CHARS to prevent token overflow.
  - Chunks from each document are truncated proportionally so every document
    gets a fair share of the context window regardless of its size.
  - The system prompt is kept as a module-level constant so reviewers can read
    and adjust it without hunting through call stacks.
"""

from __future__ import annotations

import logging
import os
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Tuneable constants (can be overridden via environment variables)
# ---------------------------------------------------------------------------

# Hard cap on the total character count fed to the LLM.
# At ~4 chars/token this equates to roughly 3 500 tokens of context.
MAX_TOTAL_CONTEXT_CHARS: int = int(os.getenv("COMPARE_MAX_CONTEXT_CHARS", "14000"))

# Maximum number of documents allowed in a single comparison request.
MAX_DOCUMENTS: int = int(os.getenv("COMPARE_MAX_DOCUMENTS", "10"))

# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

COMPARISON_SYSTEM_PROMPT = """\
You are a legal document comparison assistant. You will be provided with \
excerpts from multiple legal documents.

Your tasks:
1. Compare clauses across the provided documents.
2. Identify conflicts and inconsistencies between them.
3. Highlight overlapping obligations and shared terms.
4. Summarise key similarities and differences.
5. Cite the source document name for every finding.
6. If information is missing from a document, clearly state that.

Format your response as follows (use Markdown headings):

## Summary
A concise overview of the documents and the comparison.

## Similarities
Clauses or obligations that are consistent across documents.

## Differences
Clauses or terms that differ between documents.

## Potential Conflicts
Clauses that directly contradict each other across documents.

## Recommendations
Suggested actions or areas requiring attention.

Always mention the originating document name (e.g. **NDA.pdf**) when \
referencing a specific clause or provision.\
"""


# ---------------------------------------------------------------------------
# Context assembly helpers
# ---------------------------------------------------------------------------

def build_comparison_context(
    documents: List[Dict[str, str]],
    max_chars: int = MAX_TOTAL_CONTEXT_CHARS,
) -> str:
    """
    Assemble a formatted multi-document context block for the LLM.

    Each document is introduced with a header line and its text is truncated
    proportionally so that the total character count stays within `max_chars`.

    Parameters
    ----------
    documents:
        List of dicts with keys ``id``, ``name``, and ``text``.
    max_chars:
        Maximum total characters allowed in the returned context string.

    Returns
    -------
    str
        A formatted context block ready to be injected into the LLM prompt.

    Raises
    ------
    ValueError
        If fewer than 2 documents are supplied.
    """
    if len(documents) < 2:
        raise ValueError("At least 2 documents are required for comparison.")
    if len(documents) > MAX_DOCUMENTS:
        raise ValueError(f"Cannot compare more than {MAX_DOCUMENTS} documents at once.")

    # Proportional character budget per document
    budget_per_doc = max_chars // len(documents)

    parts: List[str] = []
    for doc in documents:
        name = doc.get("name", "Unnamed document").strip()
        text = (doc.get("text") or "").strip()

        if not text:
            parts.append(f"DOCUMENT: {name}\n[No text content available]\n{'-' * 40}")
            continue

        # Truncate to budget, ending at a sentence boundary where possible
        if len(text) > budget_per_doc:
            truncated = text[:budget_per_doc]
            # Try to end at the last full sentence to avoid mid-sentence cuts
            last_period = truncated.rfind(".")
            if last_period > budget_per_doc // 2:
                truncated = truncated[: last_period + 1]
            text = truncated + "\n... [truncated for context length]"

        parts.append(f"DOCUMENT: {name}\n{text}\n{'-' * 40}")

    return "\n\n".join(parts)


def build_comparison_prompt(
    user_message: str,
    documents: List[Dict[str, str]],
    history: Optional[List[Dict[str, str]]] = None,
    max_chars: int = MAX_TOTAL_CONTEXT_CHARS,
) -> str:
    """
    Construct the full prompt for a multi-document comparison request.

    The prompt contains:
      1. The system instructions (COMPARISON_SYSTEM_PROMPT).
      2. The assembled multi-document context.
      3. (Optionally) the last few turns of conversation history.
      4. The user's current question.

    Parameters
    ----------
    user_message:
        The user's natural-language question or instruction.
    documents:
        List of dicts with keys ``id``, ``name``, and ``text``.
    history:
        Optional conversation history (list of ``{role, content}`` dicts).
    max_chars:
        Character cap passed through to ``build_comparison_context``.

    Returns
    -------
    str
        The complete prompt string.
    """
    context_block = build_comparison_context(documents, max_chars=max_chars)

    parts = [
        COMPARISON_SYSTEM_PROMPT,
        "",
        "=== DOCUMENTS FOR COMPARISON ===",
        context_block,
    ]

    if history:
        # Include the last 6 turns to keep the prompt focused
        recent = history[-6:]
        history_lines = "\n".join(
            f"{msg['role'].capitalize()}: {msg['content']}" for msg in recent
        )
        parts += ["", "=== CONVERSATION HISTORY ===", history_lines]

    parts += ["", "=== USER QUESTION ===", user_message]

    return "\n".join(parts)


# ---------------------------------------------------------------------------
# Service class
# ---------------------------------------------------------------------------

class ComparisonService:
    """
    Coordinates multi-document comparison requests.

    Delegates the actual LLM call to ``ai_service`` so resilience logic
    (retry, timeout, graceful degradation) is shared.
    """

    async def compare_documents(
        self,
        message: str,
        documents: List[Dict[str, str]],
        history: Optional[List[Dict[str, str]]] = None,
        jurisdiction: str = "General / Not Specified",
    ) -> str:
        """
        Generate a structured cross-document comparison response.

        Parameters
        ----------
        message:
            The user's comparison question.
        documents:
            List of dicts with keys ``id``, ``name``, and ``text``.
            Must contain at least 2 entries.
        history:
            Optional previous conversation turns.
        jurisdiction:
            Legal jurisdiction context-switching parameter.

        Returns
        -------
        str
            The LLM's Markdown-formatted comparison response.
        """
        # Lazy import to avoid circular dependencies at module load time
        from backend.services.ai_service import ai_service

        if len(documents) < 2:
            raise ValueError("At least 2 documents are required for comparison.")

        prompt = build_comparison_prompt(
            user_message=message,
            documents=documents,
            history=history,
        )

        messages_payload = [{"role": "user", "content": prompt}]

        logger.info(
            "Comparison request: %d documents, prompt length %d chars",
            len(documents),
            len(prompt),
        )

        # Collect the full response (non-streaming for comparison to get the
        # complete structured output before returning)
        response_text = ""
        async for chunk in ai_service.generate_chat_response(
            message=prompt,
            context=None,
            history=None,  # history already embedded in the prompt above
            stream=False,
            jurisdiction=jurisdiction,
        ):
            response_text += chunk

        return response_text or self._fallback_response(documents)

    def _fallback_response(self, documents: List[Dict[str, str]]) -> str:
        """
        Return a graceful degradation response when the LLM is unavailable.
        """
        names = ", ".join(d.get("name", "Document") for d in documents)
        return (
            "## Summary\n\n"
            f"I am currently operating in fallback mode and cannot perform a live AI comparison "
            f"of {names}. The AI provider is temporarily unavailable.\n\n"
            "## Recommendations\n\n"
            "- Ensure the backend AI service is running and `BYTEZ_API_KEY` is configured.\n"
            "- Try uploading documents individually for single-document analysis.\n"
            "- Retry the comparison once the service is restored."
        )


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

comparison_service = ComparisonService()
