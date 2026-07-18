"""
Entity extraction service for building knowledge graphs from legal documents.

Extracts entities (parties, jurisdictions, obligations, dates) and their
relationships from legal text to power the interactive force-directed graph.
"""

import re
import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)


def extract_entities(text: str) -> Dict[str, Any]:
    """
    Extract legal entities and relationships from document text.
    
    Returns a graph structure with nodes and links suitable for
    force-directed graph visualization.
    """
    if not text or not text.strip():
        return {"nodes": [], "links": []}

    nodes = []
    links = []
    seen_nodes = set()

    # Extract party names (common legal patterns)
    party_patterns = [
        r'(?:between|by|of)\s+([A-Z][A-Za-z\s&,]+?)(?:\s*(?:\(|,|\band\b|hereinafter))',
        r'"([A-Z][A-Za-z\s]+)"',
        r'(?:Company|Employer|Employee|Contractor|Client|Provider|Licensee|Licensor|Tenant|Landlord|Buyer|Seller)\b',
    ]

    parties = set()
    for pattern in party_patterns:
        matches = re.findall(pattern, text[:5000])
        for m in matches:
            name = m.strip().rstrip(',').strip()
            if 2 < len(name) < 50:
                parties.add(name)

    # Add party nodes
    for party in list(parties)[:10]:
        node_id = f"party_{len(nodes)}"
        if party not in seen_nodes:
            nodes.append({"id": node_id, "label": party, "type": "party", "size": 8})
            seen_nodes.add(party)

    # Extract jurisdiction references
    jurisdiction_pattern = r'(?:laws?\s+of\s+(?:the\s+)?(?:State\s+of\s+)?|jurisdiction\s+of\s+)([A-Z][A-Za-z\s]+?)(?:\.|,|\s+and\b)'
    jurisdictions = set(re.findall(jurisdiction_pattern, text[:5000]))
    for j in list(jurisdictions)[:5]:
        j = j.strip()
        if j and j not in seen_nodes:
            node_id = f"jurisdiction_{len(nodes)}"
            nodes.append({"id": node_id, "label": j, "type": "jurisdiction", "size": 6})
            seen_nodes.add(j)

    # Extract key dates
    date_pattern = r'(?:effective\s+(?:as\s+of\s+)?|dated?\s+|commencing\s+on\s+)(\w+\s+\d{1,2},?\s+\d{4}|\d{1,2}/\d{1,2}/\d{4})'
    dates = set(re.findall(date_pattern, text[:5000], re.IGNORECASE))
    for d in list(dates)[:5]:
        d = d.strip()
        if d and d not in seen_nodes:
            node_id = f"date_{len(nodes)}"
            nodes.append({"id": node_id, "label": d, "type": "date", "size": 4})
            seen_nodes.add(d)

    # Extract obligation keywords
    obligation_patterns = [
        r'shall\s+([\w\s]+?)(?:\.|,|;)',
        r'must\s+([\w\s]+?)(?:\.|,|;)',
        r'agrees?\s+to\s+([\w\s]+?)(?:\.|,|;)',
    ]
    obligations = set()
    for pattern in obligation_patterns:
        matches = re.findall(pattern, text[:5000], re.IGNORECASE)
        for m in matches[:3]:
            obligation = m.strip()[:40]
            if len(obligation) > 5:
                obligations.add(obligation)

    for o in list(obligations)[:8]:
        if o not in seen_nodes:
            node_id = f"obligation_{len(nodes)}"
            nodes.append({"id": node_id, "label": o, "type": "obligation", "size": 5})
            seen_nodes.add(o)

    # Create links between entities
    party_nodes = [n for n in nodes if n["type"] == "party"]
    jurisdiction_nodes = [n for n in nodes if n["type"] == "jurisdiction"]
    obligation_nodes = [n for n in nodes if n["type"] == "obligation"]
    date_nodes = [n for n in nodes if n["type"] == "date"]

    # Link parties to each other
    for i, p1 in enumerate(party_nodes):
        for p2 in party_nodes[i + 1:]:
            links.append({"source": p1["id"], "target": p2["id"], "label": "party to", "strength": 0.8})

    # Link parties to jurisdictions
    for p in party_nodes[:3]:
        for j in jurisdiction_nodes:
            links.append({"source": p["id"], "target": j["id"], "label": "governed by", "strength": 0.5})

    # Link parties to obligations
    for p in party_nodes[:2]:
        for o in obligation_nodes:
            links.append({"source": p["id"], "target": o["id"], "label": "obligated to", "strength": 0.6})

    # Link dates to parties
    for d in date_nodes:
        if party_nodes:
            links.append({"source": party_nodes[0]["id"], "target": d["id"], "label": "effective", "strength": 0.3})

    return {"nodes": nodes, "links": links}
