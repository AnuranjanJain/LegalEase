import logging
from typing import List, Dict, Any

from langchain_community.vectorstores import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter

logger = logging.getLogger(__name__)


class RAGService:
    def __init__(self):
        self.indexed_docs = set()
        try:
            self.embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
            self.vector_store = Chroma(
                collection_name="legalease_docs",
                embedding_function=self.embeddings,
                persist_directory="./chroma_db"
            )
            self.text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=1500,
                chunk_overlap=200,
                length_function=len,
                is_separator_regex=False,
            )
            logger.info("RAG Service initialized successfully.")
        except Exception as e:
            logger.error(f"Failed to initialize RAG Service: {e}")
            self.vector_store = None

    def add_document(self, text: str, doc_id: str, filename: str = "document"):
        """Chunk, embed, and store a document. Attaches filename and chunk_index metadata."""
        if not self.vector_store or doc_id in self.indexed_docs:
            return

        chunks = self.text_splitter.split_text(text)
        metadatas = [
            {"doc_id": doc_id, "filename": filename, "chunk_index": i}
            for i, _ in enumerate(chunks)
        ]
        self.vector_store.add_texts(texts=chunks, metadatas=metadatas)
        self.indexed_docs.add(doc_id)
        logger.info(f"Indexed {len(chunks)} chunks for doc '{filename}' (id={doc_id})")

    def get_context(self, query: str, doc_id: str, top_k: int = 5) -> str:
        """Legacy plain-text context retrieval (kept for backward compatibility)."""
        citations = self.get_context_with_citations(query, doc_id, top_k)
        if not citations:
            return ""
        return "\n".join(
            f"--- Document Excerpt {i + 1} ---\n{c['text']}\n"
            for i, c in enumerate(citations)
        )

    def get_context_with_citations(
        self, query: str, doc_id: str, top_k: int = 5
    ) -> List[Dict[str, Any]]:
        """Return retrieved chunks with full citation metadata.

        Each element is a dict with keys:
          - ``text``        – the raw chunk text
          - ``source``      – original filename
          - ``chunk_index`` – zero-based index of the chunk within the document
        """
        if not self.vector_store:
            return []

        results = self.vector_store.similarity_search(
            query, k=top_k, filter={"doc_id": doc_id}
        )
        if not results:
            return []

        citations = []
        for doc in results:
            meta = doc.metadata or {}
            citations.append({
                "text": doc.page_content,
                "source": meta.get("filename", "document"),
                "chunk_index": meta.get("chunk_index", 0),
            })
        return citations

rag_service = RAGService()
