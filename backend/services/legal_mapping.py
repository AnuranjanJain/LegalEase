import re
from typing import List, Dict, Optional

LEGAL_SECTION_CATALOG: List[Dict[str, str]] = [
    {
        "code": "IPC 323",
        "source": "IPC",
        "title": "Voluntarily Causing Hurt",
        "keywords": ["hurt", "assault", "beaten", "injured", "violence", "punch", "kick"],
        "summary": "Covers intentional or voluntary causing of physical pain or injury to another person.",
        "remedy": "File an FIR, preserve evidence, and consult a criminal lawyer.",
        "severity": "Moderate"
    },
    {
        "code": "IPC 326",
        "source": "IPC",
        "title": "Voluntarily Causing Grievous Hurt",
        "keywords": ["stabbing", "knife", "deep wound", "fracture", "serious injury", "severe", "life-threatening"],
        "summary": "Applies when serious physical harm is caused intentionally, often involving weapons or severe injury.",
        "remedy": "Contact police immediately, gather medical records, and seek urgent legal advice.",
        "severity": "High"
    },
    {
        "code": "IPC 378",
        "source": "IPC",
        "title": "Theft",
        "keywords": ["theft", "stolen", "robbery", "missing", "taken without permission", "property taken"],
        "summary": "Addresses unlawfully taking someone else's property with the intent to deprive them of it.",
        "remedy": "Report the theft to police, compile proof of ownership, and file a complaint.",
        "severity": "Moderate"
    },
    {
        "code": "IPC 420",
        "source": "IPC",
        "title": "Cheating and Dishonest Inducement",
        "keywords": ["fraud", "scam", "deceived", "misled", "fake promise", "dishonest"],
        "summary": "Covers cheating someone through deceit or fraudulent promises to gain property or advantage.",
        "remedy": "Document the misrepresentation, preserve evidence, and file a legal complaint for fraud.",
        "severity": "Moderate"
    },
    {
        "code": "IPC 506",
        "source": "IPC",
        "title": "Criminal Intimidation",
        "keywords": ["threat", "intimidation", "fear", "harassment", "blackmail", "pressure"],
        "summary": "Applies when a person threatens another with injury, harm, or loss to compel them to act or refrain from acting.",
        "remedy": "Preserve any threatening messages and report the intimidation to authorities.",
        "severity": "Moderate"
    }
]


def normalize_text(text: str) -> str:
    text = text.lower()
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def score_section(section: Dict[str, str], text: str) -> int:
    score = 0
    normalized = normalize_text(text)
    for keyword in section["keywords"]:
        if keyword in normalized:
            score += 1
    return score


def map_legal_sections(problem_description: str, max_results: int = 3) -> List[Dict[str, str]]:
    """Return top matching IPC/BNS provisions for a user problem description."""
    if not problem_description or not problem_description.strip():
        return []

    scored = []
    for section in LEGAL_SECTION_CATALOG:
        score = score_section(section, problem_description)
        if score > 0:
            scored.append((score, section))

    scored.sort(key=lambda item: item[0], reverse=True)
    matches = [section for _, section in scored[:max_results]]
    return matches


def format_section_recommendations(sections: List[Dict[str, str]]) -> str:
    if not sections:
        return "No confident IPC/BNS section recommendations were identified based on the description."

    lines = ["Relevant IPC/BNS sections we identified:"]
    for section in sections:
        lines.append(f"- {section['code']} ({section['source']}): {section['title']}")
        lines.append(f"  Summary: {section['summary']}")
        lines.append(f"  Suggested remedy: {section['remedy']}")
        lines.append(f"  Severity: {section['severity']}")
    return "\n".join(lines)
