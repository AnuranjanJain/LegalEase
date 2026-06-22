import logging
from typing import List, Dict, Any, Tuple

from langchain_postgres.vectorstores import PGVector
from langchain_community.vectorstores import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
import os
import threading
from typing import List
from fastapi.concurrency import run_in_threadpool

logger = logging.getLogger(__name__)

RAG_DEPS_AVAILABLE = True

class RAGService:
    def __init__(self):
        self.indexed_docs = set()
        self.embeddings = None
        self.vector_store = None
        self.text_splitter = None
        self.is_initialized = False
        self._init_lock = threading.Lock()

    def _lazy_init(self):
        """
        Lazily initialize RAG dependencies in a thread-safe manner.
        This prevents heavy model loading and DB connection logic from
        blocking module imports or server startup.
        """
        if self.is_initialized:
            return

        with self._init_lock:
            # Double-check lock pattern
            if self.is_initialized:
                return

            try:
                if not RAG_DEPS_AVAILABLE:
                    raise RuntimeError("RAG dependencies are not available on this system due to import/DLL load errors.")

                logger.info("Lazily initializing RAG Service components...")
                
                self.embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
                
                # Read database URL from environment
                _database_url = os.getenv("DATABASE_URL", "")
                
                # Use PGVector if connected to Postgres, otherwise fallback to local Chroma
                if _database_url.startswith("postgres"):
                    # Normalise for psycopg
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
                self.is_initialized = True
                logger.info("RAG Service initialized successfully.")
            except Exception as e:
                logger.error(f"Failed to initialize RAG Service: {e}", exc_info=True)
                self.vector_store = None
                self.embeddings = None
                self.text_splitter = None
                # Do not set self.is_initialized = True to allow retries on subsequent requests

    async def add_document(self, text: str, doc_id: str, file_name: str = "Document"):
        """
        Asynchronously add document text to the vector store.
        Offloads chunking and embedding operations to a worker thread.
        """
        if doc_id in self.indexed_docs:
            return
        
        await run_in_threadpool(self._add_document_sync, text, doc_id, file_name)

    def _add_document_sync(self, text: str, doc_id: str, file_name: str = "Document"):
        if not self.is_initialized:
            self._lazy_init()

        if not self.vector_store:
            logger.warning("RAG vector store unavailable. Skipping document ingestion.")
            return

        try:
            chunks = self.text_splitter.split_text(text)
            metadatas = [{"doc_id": doc_id, "source": file_name, "chunk_index": i} for i, _ in enumerate(chunks)]
            self.vector_store.add_texts(texts=chunks, metadatas=metadatas)
            self.indexed_docs.add(doc_id)
            logger.info(f"Indexed {len(chunks)} chunks for doc {doc_id}")
        except Exception as e:
            logger.error(f"Failed to add document {doc_id} to vector store: {e}", exc_info=True)
            raise e

    async def get_context(self, query: str, doc_id: str, top_k: int = 5) -> Tuple[str, List[Dict[str, Any]]]:
        """
        Asynchronously perform similarity search and retrieve matching document excerpts.
        Offloads querying and embedding operations to a worker thread.
        """
        return await run_in_threadpool(self._get_context_sync, query, doc_id, top_k)

    def _get_context_sync(self, query: str, doc_id: str, top_k: int = 5) -> Tuple[str, List[Dict[str, Any]]]:
        if not self.is_initialized:
            self._lazy_init()

        if not self.vector_store:
            logger.warning("RAG vector store unavailable. Returning empty context.")
            return "", []

        try:
            results = self.vector_store.similarity_search(query, k=top_k, filter={"doc_id": doc_id})
            if not results:
                return "", []
                
            context_parts = []
            citations = []
            for i, doc in enumerate(results):
                context_parts.append(f"--- Document Excerpt [{i+1}] ---\n{doc.page_content}\n")
                meta = doc.metadata or {}
                citations.append({
                    "text": doc.page_content[:200] + "...",
                    "source": meta.get("source", "Document"),
                    "chunk_index": meta.get("chunk_index", i)
                })
                
            return "\n".join(context_parts), citations
        except Exception as e:
            logger.error(f"Failed to query context for document {doc_id}: {e}", exc_info=True)
            raise e

rag_service = RAGService()
