import logging
from typing import List

from langchain_postgres.vectorstores import PGVector
from langchain_community.vectorstores import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
import os

logger = logging.getLogger(__name__)

class RAGService:
    def __init__(self):
        self.indexed_docs = set()
        try:
            self.embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
            
            # Read database URL from environment
            _database_url = os.getenv("DATABASE_URL", "")
            
            # Use PGVector if connected to Postgres, otherwise fallback to local Chroma
            if _database_url.startswith("postgres"):
                # Normalise for asyncpg/psycopg if needed, but PGVector works with postgresql+psycopg
                if _database_url.startswith("postgres://"):
                    _database_url = _database_url.replace("postgres://", "postgresql+psycopg://", 1)
                elif _database_url.startswith("postgresql://"):
                    _database_url = _database_url.replace("postgresql://", "postgresql+psycopg://", 1)

                self.vector_store = PGVector(
                    embeddings=self.embeddings,
                    collection_name="legalease_docs",
                    connection=_database_url,
                    use_jsonb=True,
                )
                logger.info("RAG Service initialized with PostgreSQL pgvector.")
            else:
                self.vector_store = Chroma(
                    collection_name="legalease_docs",
                    embedding_function=self.embeddings,
                    persist_directory="./chroma_db"
                )
                logger.info("RAG Service initialized with local ChromaDB fallback.")

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

    def add_document(self, text: str, doc_id: str):
        if not self.vector_store or doc_id in self.indexed_docs:
            return
        
        chunks = self.text_splitter.split_text(text)
        metadatas = [{"doc_id": doc_id} for _ in chunks]
        self.vector_store.add_texts(texts=chunks, metadatas=metadatas)
        self.indexed_docs.add(doc_id)
        logger.info(f"Indexed {len(chunks)} chunks for doc {doc_id}")

    def get_context(self, query: str, doc_id: str, top_k: int = 5) -> str:
        if not self.vector_store:
            return ""
        
        results = self.vector_store.similarity_search(query, k=top_k, filter={"doc_id": doc_id})
        if not results:
            return ""
            
        context_parts = []
        for i, doc in enumerate(results):
            context_parts.append(f"--- Document Excerpt {i+1} ---\n{doc.page_content}\n")
            
        return "\n".join(context_parts)

rag_service = RAGService()
