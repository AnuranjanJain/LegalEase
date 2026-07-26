import logging
import time
from dataclasses import dataclass
from typing import List, Dict, Any, Tuple, Optional

from langchain_postgres.vectorstores import PGVector
from langchain_community.vectorstores import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
import os
import threading
from typing import List
from fastapi.concurrency import run_in_threadpool
from backend.config import get_settings

logger = logging.getLogger(__name__)

RAG_DEPS_AVAILABLE = True


@dataclass
class RAGInitState:
    state: str = "UNINITIALIZED"
    last_attempt_at: Optional[float] = None
    last_failure_at: Optional[float] = None
    failure_reason: Optional[str] = None
    exception_type: Optional[str] = None
    failure_kind: Optional[str] = None
    retry_count: int = 0
    last_success_at: Optional[float] = None

class RAGService:
    def __init__(self):
        self.indexed_docs = set()
        self.embeddings = None
        self.vector_store = None
        self.text_splitter = None
        self.is_initialized = False
        self._init_lock = threading.Lock()
        self._init_state = RAGInitState()

    def _lazy_init(self):
        """
        Lazily initialize RAG dependencies in a thread-safe manner.
        This prevents heavy model loading and DB connection logic from
        blocking module imports or server startup.
        """
        if self.is_initialized:
            return

        settings = get_settings().ai
        now = time.time()
        retry_interval = max(int(settings.rag_init_retry_interval), 0)
        max_init_retries = max(int(settings.rag_max_init_retries), 0)

        if self._init_state.state == "FAILED" and self._init_state.failure_kind == "permanent":
            return

        if self._init_state.retry_count >= max_init_retries > 0:
            self._init_state.state = "FAILED"
            return

        if (
            self._init_state.state == "FAILED"
            and self._init_state.last_failure_at is not None
            and retry_interval > 0
            and now - self._init_state.last_failure_at < retry_interval
        ):
            return

        with self._init_lock:
            # Double-check lock pattern
            if self.is_initialized:
                return

            if self._init_state.state == "FAILED" and self._init_state.failure_kind == "permanent":
                return

            if self._init_state.retry_count >= max_init_retries > 0:
                self._init_state.state = "FAILED"
                return

            if (
                self._init_state.state == "FAILED"
                and self._init_state.last_failure_at is not None
                and retry_interval > 0
                and time.time() - self._init_state.last_failure_at < retry_interval
            ):
                return

            self._init_state.state = "INITIALIZING"
            self._init_state.last_attempt_at = time.time()

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
                self._init_state.state = "READY"
                self._init_state.last_success_at = time.time()
                self._init_state.failure_reason = None
                self._init_state.exception_type = None
                self._init_state.retry_count = 0
                logger.info("RAG Service initialized successfully.")
            except Exception as e:
                self._init_state.retry_count += 1
                self._init_state.state = "FAILED"
                self._init_state.last_failure_at = time.time()
                self._init_state.failure_reason = str(e)
                self._init_state.exception_type = type(e).__name__
                self._init_state.failure_kind = self._classify_failure(e)
                logger.error("Failed to initialize RAG Service. Entering degraded mode.", exc_info=True)
                self.vector_store = None
                self.embeddings = None
                self.text_splitter = None
                self.is_initialized = False
                if self._init_state.failure_kind == "permanent":
                    self._init_state.retry_count = max(self._init_state.retry_count, max_init_retries or self._init_state.retry_count)

    def _should_attempt_recovery(self) -> bool:
        settings = get_settings().ai
        if not settings.rag_enable_auto_recovery:
            return False
        if self._init_state.failure_kind == "permanent":
            return False
        if self._init_state.state != "FAILED":
            return True
        if self._init_state.last_failure_at is None:
            return True
        return (time.time() - self._init_state.last_failure_at) >= max(int(settings.rag_init_retry_interval), 0)

    def _classify_failure(self, exc: Exception) -> str:
        permanent_types = (ImportError, ModuleNotFoundError, AttributeError, OSError, RuntimeError)
        message = str(exc).lower()
        if isinstance(exc, permanent_types):
            return "permanent"
        if any(token in message for token in ("dll", "missing package", "unsupported platform", "incompatible", "invalid model configuration")):
            return "permanent"
        return "transient"

    def _ensure_initialized(self) -> bool:
        if self.is_initialized:
            return True

        if self._init_state.state == "FAILED" and not self._should_attempt_recovery():
            logger.debug("RAG unavailable. Initialization previously failed. Skipping initialization.")
            return False

        self._lazy_init()
        return self.is_initialized

    def check_health(self) -> Dict[str, Any]:
        state = self._init_state.state
        if self.is_initialized:
            state = "READY"
        elif state == "FAILED":
            settings = get_settings().ai
            if settings.rag_enable_auto_recovery and self._should_attempt_recovery():
                state = "RETRYING"
            else:
                state = "DEGRADED"
        elif state == "INITIALIZING":
            state = "INITIALIZING"
        else:
            state = "UNINITIALIZED"

        details = {
            "state": state.lower(),
            "last_initialization_attempt": self._init_state.last_attempt_at,
            "last_failure_at": self._init_state.last_failure_at,
            "failure_reason": self._init_state.failure_reason,
            "exception_type": self._init_state.exception_type,
            "failure_kind": self._init_state.failure_kind,
            "retry_count": self._init_state.retry_count,
        }
        return {"status": state.lower(), "details": details}

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
            self._ensure_initialized()

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
            self._ensure_initialized()

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
