import os
import time
import logging
import asyncio
from typing import Optional, List, Dict, Any, AsyncGenerator
from contextvars import ContextVar

# Optional imports
try:
    from bytez import Bytez  # type: ignore[import-untyped]
except Exception:
    Bytez = None

from backend.core.exceptions import ProviderError, TimeoutError, ServiceUnavailableError

logger = logging.getLogger(__name__)

# Context variable for request correlation ID (set by middleware)
correlation_id_var: ContextVar[str] = ContextVar("correlation_id", default="system")


class AIService:
    def __init__(self):
        self.api_key = os.getenv("BYTEZ_API_KEY")
        self.chat_model_name = os.getenv("CHAT_MODEL", "inference-net/Schematron-3B")
        self.summarize_model_name = os.getenv("SUMMARIZE_MODEL", "inference-net/Schematron-3B")
        self.max_model_input_chars = int(os.getenv("MAX_MODEL_INPUT_CHARS", "2000"))
        
        # Resilience parameters
        self.provider_timeout = float(os.getenv("PROVIDER_TIMEOUT", "30.0"))
        self.max_retries = int(os.getenv("PROVIDER_RETRIES", "3"))
        self.retry_backoff_factor = float(os.getenv("RETRY_BACKOFF_FACTOR", "2.0"))
        self.graceful_degradation = os.getenv("GRACEFUL_DEGRADATION", "true").lower() in ("true", "1", "yes")
        self.stub_mode = os.getenv("STUB_MODE", "false").lower() in ("true", "1", "yes")
        
        # Client initialization
        self.client = None
        if self.stub_mode:
            logger.info("AIService initialized in STUB_MODE")
        elif self.api_key and Bytez is not None:
            try:
                self.client = Bytez(self.api_key)
                logger.info(f"Bytez client initialized. Chat model: {self.chat_model_name}, Summarize model: {self.summarize_model_name}")
            except Exception as e:
                logger.error(f"Failed to initialize Bytez client: {e}")
        else:
            logger.warning("BYTEZ_API_KEY not configured or Bytez SDK unavailable. AI service running in degraded fallback mode.")

    def _get_corr_id(self) -> str:
        return correlation_id_var.get()

    async def _execute_with_retry_and_timeout(self, model_name: str, messages: List[Dict[str, str]]) -> Any:
        """
        Execute Bytez model.run with timeout handling and provider retry strategy (exponential backoff).
        """
        if self.stub_mode or not self.client:
            raise ServiceUnavailableError("AI Provider not configured or in stub/degraded mode")
            
        try:
            model = self.client.model(model_name)
        except Exception as e:
            logger.error(f"[{self._get_corr_id()}] Failed to resolve Bytez model '{model_name}': {e}")
            raise ProviderError(f"Model resolution failed: {e}")

        last_err = None
        delay = 1.0
        
        for attempt in range(1, self.max_retries + 1):
            start_time = time.time()
            try:
                logger.info(f"[{self._get_corr_id()}] Calling model '{model_name}' (Attempt {attempt}/{self.max_retries})")
                
                # Execute in thread pool to prevent blocking the event loop
                output = await asyncio.wait_for(
                    asyncio.to_thread(model.run, messages),
                    timeout=self.provider_timeout
                )
                
                latency = time.time() - start_time
                logger.info(f"[{self._get_corr_id()}] Model '{model_name}' succeeded in {latency:.3f}s")
                
                # Check for explicit model errors returned by Bytez
                if hasattr(output, 'error') and output.error:
                    raise ProviderError(str(output.error))
                    
                return output
                
            except asyncio.TimeoutError:
                latency = time.time() - start_time
                last_err = TimeoutError(f"Model call timed out after {self.provider_timeout}s")
                logger.warning(f"[{self._get_corr_id()}] Timeout on attempt {attempt} after {latency:.3f}s")
            except Exception as e:
                latency = time.time() - start_time
                last_err = ProviderError(str(e))
                logger.warning(f"[{self._get_corr_id()}] Error on attempt {attempt} after {latency:.3f}s: {e}")
                
            if attempt < self.max_retries:
                logger.info(f"[{self._get_corr_id()}] Retrying in {delay:.2f}s...")
                await asyncio.sleep(delay)
                delay *= self.retry_backoff_factor

        logger.error(f"[{self._get_corr_id()}] All {self.max_retries} attempts failed for model '{model_name}'")
        raise last_err or ProviderError("AI inference failed after multiple attempts")

    def _generate_fallback_chat(self, prompt: str) -> str:
        """
        Generate a rich, helpful, domain-specific fallback response for chat.
        """
        return (
            "I am currently operating in legal-assistant fallback mode because the AI provider is unavailable. "
            "Based on general principles of contract analysis, please ensure you review important clauses manually. "
            "If this is a local development instance, please make sure `BYTEZ_API_KEY` is set in your environment configuration."
        )

    def _generate_fallback_summary(self, text: str) -> str:
        """
        Generate a deterministic extractive fallback summary.
        """
        lines = [line.strip() for line in text.split("\n") if line.strip()]
        extractive = " ".join(lines[:3]) if lines else "No text content available to summarize."
        return (
            f"[OFFLINE SUMMARY FALLBACK]\n"
            f"The AI summarization engine is currently offline. Here is an extracted summary of the document opening:\n\n"
            f"\"{extractive}\"\n\n"
            f"Please verify key terms manually or check service availability."
        )

    async def generate_chat_response(
        self, 
        message: str, 
        context: Optional[str] = None, 
        history: Optional[List[Dict[str, str]]] = None,
        stream: bool = False
    ) -> AsyncGenerator[str, None]:
        """
        Generate response for chatbot requests.
        Handles prompt construction, early rejection truncation limits, retry, and streaming chunk-by-chunk.
        """
        # Construct prompt
        parts = []
        if context:
            parts.append(f"Context from document:\n{context}")
        if history:
            history_text = "\n".join([
                f"{msg['role']}: {msg['content']}"
                for msg in history[-10:]
            ])
            parts.append(f"Previous conversation:\n{history_text}")
        parts.append(f"Current question: {message}")
        prompt = "\n\n".join(parts)
        
        # Truncation for model input constraints
        if len(prompt) > self.max_model_input_chars:
            logger.info(f"[{self._get_corr_id()}] Prompt length ({len(prompt)}) exceeds max limit ({self.max_model_input_chars}). Truncating.")
            prompt = prompt[:self.max_model_input_chars]
            
        messages = [{"role": "user", "content": prompt}]
        
        response_text = ""
        try:
            if self.stub_mode:
                response_text = f"[STUB CHAT RESPONSE] Received message: '{message}'"
            else:
                output = await self._execute_with_retry_and_timeout(self.chat_model_name, messages)
                response_text = output.output if hasattr(output, 'output') else str(output)
        except Exception as e:
            if self.graceful_degradation:
                logger.info(f"[{self._get_corr_id()}] Graceful degradation fallback activated for error: {e}")
                response_text = self._generate_fallback_chat(prompt)
            else:
                logger.error(f"[{self._get_corr_id()}] Error in chat response, graceful degradation disabled: {e}")
                raise

        # Stream handling
        if stream:
            # We yield words/chunks simulating a streaming channel to reduce perceived latency
            words = response_text.split(" ")
            for i, word in enumerate(words):
                chunk = word + (" " if i < len(words) - 1 else "")
                yield chunk
                await asyncio.sleep(0.01)  # small pause for visual effect
        else:
            yield response_text

    async def generate_summary(self, text: str) -> str:
        """
        Generate legal summaries for document analysis.
        """
        prompt = f"Please summarize the following legal document or clause, highlighting key terms and potential risks:\n\n{text}"
        
        # Truncation for model input constraints
        if len(prompt) > self.max_model_input_chars:
            logger.info(f"[{self._get_corr_id()}] Summary prompt length ({len(prompt)}) exceeds max limit ({self.max_model_input_chars}). Truncating.")
            prompt = prompt[:self.max_model_input_chars]
            
        messages = [{"role": "user", "content": prompt}]
        
        try:
            if self.stub_mode:
                return f"[STUB SUMMARY RESPONSE] Document summary for input of length {len(text)} characters."
                
            output = await self._execute_with_retry_and_timeout(self.summarize_model_name, messages)
            return output.output if hasattr(output, 'output') else str(output)
        except Exception as e:
            if self.graceful_degradation:
                logger.info(f"[{self._get_corr_id()}] Graceful degradation fallback activated for summary error: {e}")
                return self._generate_fallback_summary(text)
            else:
                logger.error(f"[{self._get_corr_id()}] Error in summary generation, graceful degradation disabled: {e}")
                raise

    def check_health(self) -> Dict[str, Any]:
        """
        Provide detailed diagnostics for health endpoint.
        """
        status = "ok"
        details = {
            "bytez": bool(self.client),
            "initialized": bool(self.client),
            "stub_mode": self.stub_mode,
            "graceful_degradation": self.graceful_degradation,
            "chat_model": self.chat_model_name,
            "summarize_model": self.summarize_model_name,
        }
        if not self.client and not self.stub_mode:
            status = "degraded"
        return {"status": status, "details": details}



# Global singleton instance
ai_service = AIService()
