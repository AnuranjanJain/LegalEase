import logging
import operator
from typing import Annotated, Dict, Any, List, TypedDict
from langgraph.graph import StateGraph, START, END

logger = logging.getLogger(__name__)

# Define our State
class AgentState(TypedDict):
    query: str
    documents: List[str]
    context: str
    analysis: str
    response: str
    needs_search: bool

# Define nodes
def initial_analysis(state: AgentState) -> Dict[str, Any]:
    """Determine if query needs external context or document context."""
    logger.debug("Running initial_analysis")
    query = state["query"]
    needs_search = "search" in query.lower() or "latest" in query.lower()
    return {"needs_search": needs_search}

def retrieve_context(state: AgentState) -> Dict[str, Any]:
    """Retrieve document context."""
    logger.debug("Running retrieve_context")
    docs = state.get("documents", [])
    context = "\n".join(docs) if docs else "No documents provided."
    return {"context": context}

def web_search(state: AgentState) -> Dict[str, Any]:
    """Perform a mock web search or integrate with duckduckgo."""
    logger.debug("Running web_search")
    return {"context": state.get("context", "") + "\n[Web Search Results: Retrieved relevant case law]"}

def generate_response(state: AgentState) -> Dict[str, Any]:
    """Generate final response based on context."""
    logger.debug("Running generate_response")
    context = state.get("context", "")
    query = state.get("query", "")
    # In a real app, this calls an LLM
    response = f"Analyzed query: '{query}' using context: {context[:50]}..."
    return {"response": response}

def build_graph() -> StateGraph:
    workflow = StateGraph(AgentState)

    # Add nodes
    workflow.add_node("initial_analysis", initial_analysis)
    workflow.add_node("retrieve_context", retrieve_context)
    workflow.add_node("web_search", web_search)
    workflow.add_node("generate_response", generate_response)

    # Add edges
    workflow.add_edge(START, "initial_analysis")

    def route_after_analysis(state: AgentState) -> str:
        if state.get("needs_search", False):
            return "web_search"
        return "retrieve_context"

    workflow.add_conditional_edges(
        "initial_analysis",
        route_after_analysis,
        {
            "web_search": "web_search",
            "retrieve_context": "retrieve_context"
        }
    )

    workflow.add_edge("web_search", "generate_response")
    workflow.add_edge("retrieve_context", "generate_response")
    workflow.add_edge("generate_response", END)

    return workflow.compile()

# Singleton graph instance
agent_graph = build_graph()

async def run_agent(query: str, documents: List[str] = None) -> str:
    """Run the LangGraph workflow."""
    if documents is None:
        documents = []
    
    initial_state = {
        "query": query,
        "documents": documents,
        "context": "",
        "analysis": "",
        "response": "",
        "needs_search": False
    }
    
    # Run graph
    result = await agent_graph.ainvoke(initial_state)
    return result.get("response", "Error generating response.")
