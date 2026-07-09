"""
diff_service.py
────────────────
Word-level structural diff between two document texts.

Unlike the AI-powered comparison/conflict endpoints in comparison_service.py,
this produces an exact, deterministic diff (insertions/deletions/unchanged
segments) with no LLM involved, suitable for a "track changes" style view
between two versions of a contract.
"""

from __future__ import annotations

import difflib
import re
from typing import Any, Dict, List

# Splits text into word runs, individual punctuation characters, and
# whitespace runs, all as separate tokens. Punctuation is split from words
# (rather than treated as part of the preceding \S+ run) so that a trailing
# period on the last word of a sentence doesn't cause the word itself to be
# flagged as changed just because a following word was added or removed.
# Concatenating every token reconstructs the original text exactly.
_TOKEN_PATTERN = re.compile(r"\w+|[^\w\s]|\s+")


def _tokenize(text: str) -> List[str]:
    return _TOKEN_PATTERN.findall(text)


def compute_diff(original_text: str, revised_text: str) -> Dict[str, Any]:
    """
    Compute a word-level diff between two document texts.

    Returns a dict with:
      - segments: ordered list of {"type": "equal"|"added"|"removed", "text": str}
      - stats: counts of added/removed/unchanged words and a similarity ratio
    """
    original_tokens = _tokenize(original_text)
    revised_tokens = _tokenize(revised_text)

    matcher = difflib.SequenceMatcher(a=original_tokens, b=revised_tokens, autojunk=False)

    segments: List[Dict[str, str]] = []
    added_words = 0
    removed_words = 0
    equal_words = 0

    def _count_words(tokens: List[str]) -> int:
        # Only count actual word tokens, not standalone punctuation or whitespace.
        return sum(1 for t in tokens if re.match(r"^\w+$", t))

    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            text = "".join(original_tokens[i1:i2])
            if text:
                segments.append({"type": "equal", "text": text})
            equal_words += _count_words(original_tokens[i1:i2])
        elif tag == "delete":
            text = "".join(original_tokens[i1:i2])
            if text:
                segments.append({"type": "removed", "text": text})
            removed_words += _count_words(original_tokens[i1:i2])
        elif tag == "insert":
            text = "".join(revised_tokens[j1:j2])
            if text:
                segments.append({"type": "added", "text": text})
            added_words += _count_words(revised_tokens[j1:j2])
        elif tag == "replace":
            removed_text = "".join(original_tokens[i1:i2])
            added_text = "".join(revised_tokens[j1:j2])
            if removed_text:
                segments.append({"type": "removed", "text": removed_text})
            if added_text:
                segments.append({"type": "added", "text": added_text})
            removed_words += _count_words(original_tokens[i1:i2])
            added_words += _count_words(revised_tokens[j1:j2])

    return {
        "segments": segments,
        "stats": {
            "added_words": added_words,
            "removed_words": removed_words,
            "unchanged_words": equal_words,
            "similarity_ratio": round(matcher.ratio(), 4),
        },
    }
