import time
import logging
import asyncio
from typing import Optional, List, Dict, Any, AsyncGenerator
from contextvars import ContextVar

from backend.config import get_settings

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
        # Get configuration from centralized settings
        settings = get_settings()
        ai_config = settings.ai
        
        self.api_key = ai_config.bytez_api_key
        self.chat_model_name = ai_config.chat_model
        self.summarize_model_name = ai_config.summarize_model
        self.max_model_input_chars = ai_config.max_model_input_chars
        
        # Resilience parameters
        self.provider_timeout = ai_config.provider_timeout
        self.max_retries = ai_config.provider_retries
        self.retry_backoff_factor = ai_config.retry_backoff_factor
        self.graceful_degradation = ai_config.graceful_degradation
        self.stub_mode = ai_config.stub_mode
        
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
        stream: bool = False,
        jurisdiction: str = "General / Not Specified"
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
            
        # Inject jurisdiction instructions
        instruction = (
            "You are an expert legal assistant.\n\n"
            f"Analyze all legal questions and uploaded documents strictly according to the laws and regulations of: {jurisdiction}.\n\n"
            "If legal conclusions depend on jurisdiction-specific rules:\n\n"
            "* Explicitly mention them.\n"
            "* Flag potentially unenforceable clauses.\n"
            "* Explain why the clause may be invalid in this jurisdiction.\n"
            "* State when legal outcomes differ across jurisdictions.\n\n"
            "Do not assume laws from any other jurisdiction unless comparing them."
        )
        injected_message = f"{instruction}\n\n{message}"
        parts.append(f"Current question: {injected_message}")
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
            import json
            # We yield words/chunks simulating a streaming channel to reduce perceived latency
            words = response_text.split(" ")
            for i, word in enumerate(words):
                chunk = word + (" " if i < len(words) - 1 else "")
                # Yield proper Server-Sent Events (SSE) format
                payload = json.dumps({"response": chunk})
                yield f"data: {payload}\n\n"
                await asyncio.sleep(0.01)  # small pause for visual effect
            yield "data: [DONE]\n\n"
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

    async def suggest_redline(
        self, clause_text: str, risk_reason: str = "", jurisdiction: str = "General / Not Specified"
    ) -> str:
        """
        Suggest an alternative, less risky phrasing for a contract clause.

        Intended to run on a single clause already flagged by analyze_clauses,
        so the output can be fed directly into the redline DOCX export
        (original_text / suggested_text).
        """
        if not clause_text or not clause_text.strip():
            return ""

        risk_context = f"\n\nThis clause was flagged with the following concern: {risk_reason}" if risk_reason else ""
        prompt = (
            "You are a contract negotiation assistant. Rewrite the following clause to reduce risk "
            "for the party reviewing the contract, while preserving its core commercial intent and "
            f"remaining valid under the laws of: {jurisdiction}. "
            "Keep the rewritten clause concise and in formal legal language.\n\n"
            "Respond with ONLY the rewritten clause text. Do not include any explanation, "
            "commentary, markdown formatting, or conversational filler.\n"
            f"{risk_context}\n\n"
            f"Original clause:\n{clause_text}"
        )

        if len(prompt) > self.max_model_input_chars:
            logger.info(f"[{self._get_corr_id()}] Redline prompt length ({len(prompt)}) exceeds max limit ({self.max_model_input_chars}). Truncating.")
            prompt = prompt[:self.max_model_input_chars]

        messages = [{"role": "user", "content": prompt}]

        if self.stub_mode:
            return f"[STUB REDLINE SUGGESTION] Revised version of: {clause_text[:80]}"

        try:
            output = await self._execute_with_retry_and_timeout(self.chat_model_name, messages)
            suggestion = output.output if hasattr(output, 'output') else str(output)
            return suggestion.strip()
        except Exception as e:
            if self.graceful_degradation:
                logger.info(f"[{self._get_corr_id()}] Graceful degradation fallback activated for redline suggestion error: {e}")
                return (
                    "Unable to generate an automated redline suggestion right now. "
                    "Please review this clause manually and consult qualified legal counsel before relying on it."
                )
            logger.error(f"[{self._get_corr_id()}] Error in redline suggestion, graceful degradation disabled: {e}")
            raise

    async def simplify_clause(self, text: str) -> str:
        """
        Simplify the legal text into plain English.
        """
        prompt = (
            "Explain the following legal text in simple, plain English. "
            "Preserve the original meaning, highlight obligations, risks, and important actions, "
            "and keep the explanation concise and understandable for non-lawyers.\n\n"
            f"Legal Text:\n{text}"
        )
        
        # Truncation for model input constraints
        if len(prompt) > self.max_model_input_chars:
            logger.info(f"[{self._get_corr_id()}] Simplify prompt length ({len(prompt)}) exceeds max limit ({self.max_model_input_chars}). Truncating.")
            prompt = prompt[:self.max_model_input_chars]
            
        messages = [{"role": "user", "content": prompt}]
        
        try:
            if self.stub_mode:
                return f"[STUB SIMPLIFY RESPONSE] Simplified explanation for input of length {len(text)} characters."
                
            output = await self._execute_with_retry_and_timeout(self.chat_model_name, messages)
            return output.output if hasattr(output, 'output') else str(output)
        except Exception as e:
            if self.graceful_degradation:
                logger.info(f"[{self._get_corr_id()}] Graceful degradation fallback activated for simplify error: {e}")
                return (
                    "I am currently operating in legal-assistant fallback mode because the AI provider is unavailable. "
                    "Based on general principles of contract analysis, please review the obligations and risks in this clause manually. "
                    "This section details specific terms regarding the contract duration, termination rights, or liability."
                )
            else:
                logger.error(f"[{self._get_corr_id()}] Error in simplify generation, graceful degradation disabled: {e}")
                raise

    async def analyze_clauses(self, text: str) -> List[Dict[str, Any]]:
        """
        Analyze contract clauses and extract key clauses with risk levels and reasons.
        """
        if not text or not text.strip():
            return []

        prompt = (
            "Analyze the following legal text and extract up to 5 key clauses. "
            "For each clause, assign a riskLevel ('High', 'Medium', or 'Low') and a riskReason "
            "explaining the risk assignment. Additionally, assign a liability_score from 1 to 100 representing the severity.\n\n"
            "You MUST respond ONLY with a valid JSON array of objects, where each object has these exact keys:\n"
            "  - \"clause\": the exact text of the contract clause\n"
            "  - \"riskLevel\": the assigned risk level ('High', 'Medium', 'Low')\n"
            "  - \"riskReason\": a brief explanation of why this risk level was assigned\n"
            "  - \"liability_score\": integer from 1 to 100\n\n"
            "Do not include any other commentary, markdown formatting (outside of valid JSON structure), "
            "or conversational filler. Output must be parsable as JSON.\n\n"
            f"Text to analyze:\n{text}"
        )

        # Truncation for model input constraints
        if len(prompt) > self.max_model_input_chars:
            prompt = prompt[:self.max_model_input_chars]

        messages = [{"role": "user", "content": prompt}]

        # Check for stub mode
        if self.stub_mode:
            return [
                {
                    "clause": "The company may terminate this agreement at any time without notice.",
                    "riskLevel": "High",
                    "riskReason": "Unilateral termination rights may negatively impact the user.",
                    "liability_score": 85
                },
                {
                    "clause": "Subscriber shall indemnify and hold harmless Provider against any and all claims.",
                    "riskLevel": "Medium",
                    "riskReason": "Broad indemnification clauses can lead to unexpected liabilities.",
                    "liability_score": 60
                },
                {
                    "clause": "This Agreement shall be governed by the laws of the State of Delaware.",
                    "riskLevel": "Low",
                    "riskReason": "Standard governing law clause, standard jurisdiction choice.",
                    "liability_score": 15
                }
            ]

        try:
            output = await self._execute_with_retry_and_timeout(self.chat_model_name, messages)
            response_text = output.output if hasattr(output, 'output') else str(output)
            return self._parse_clauses_json(response_text)
        except Exception as e:
            logger.error(f"[{self._get_corr_id()}] Clause analysis failed: {e}")
            if self.graceful_degradation:
                # Return standard fallback clauses
                return [
                    {
                        "clause": "The company may terminate this agreement at any time without notice.",
                        "riskLevel": "High",
                        "riskReason": "Unilateral termination rights may negatively impact the user (fallback)."
                    }
                ]
            raise

    def _extract_json_array_balanced(self, text: str) -> Optional[str]:
        """
        Extract the first valid JSON array using balanced bracket parsing.
        This avoids the greedy regex matching issues and handles nested structures correctly.
        """
        import re
        
        # Find the first opening bracket
        start_idx = text.find('[')
        if start_idx == -1:
            logger.debug(f"[{self._get_corr_id()}] No opening bracket found in text")
            return None
        
        bracket_count = 0
        in_string = False
        escape_next = False
        
        for i in range(start_idx, len(text)):
            char = text[i]
            
            # Handle escape sequences
            if escape_next:
                escape_next = False
                continue
            
            if char == '\\':
                escape_next = True
                continue
            
            # Track string boundaries
            if char == '"':
                in_string = not in_string
                continue
            
            # Only count brackets outside strings
            if not in_string:
                if char == '[':
                    bracket_count += 1
                elif char == ']':
                    bracket_count -= 1
                    
                    # When we close the outermost bracket, we have a complete array
                    if bracket_count == 0:
                        return text[start_idx:i+1]
        
        logger.debug(f"[{self._get_corr_id()}] Unbalanced brackets in text")
        return None

    def _clean_json_string(self, json_str: str) -> str:
        """
        Clean common JSON formatting issues from LLM outputs.
        Handles trailing commas, extra whitespace, etc.
        """
        import re
        
        # Remove trailing commas before closing brackets/braces
        # This handles: [ {"a": 1,}, ] -> [ {"a": 1} ]
        cleaned = re.sub(r',(\s*[}\]])', r'\1', json_str)
        
        # Remove trailing commas at end of array/object (apply again to catch nested cases)
        cleaned = re.sub(r',(\s*[}\]])', r'\1', cleaned)
        
        return cleaned.strip()

    def _extract_from_markdown(self, text: str) -> str:
        """
        Extract JSON content from various markdown formats.
        Handles code blocks with or without language specifiers.
        """
        import re
        
        # Try standard markdown code blocks first
        match = re.search(r'```(?:json|text)?\s*([\s\S]*?)\s*```', text, re.IGNORECASE)
        if match:
            return match.group(1).strip()
        
        # Try to find content between any code fences
        match = re.search(r'```([\s\S]*?)```', text)
        if match:
            return match.group(1).strip()
        
        # No markdown found, return original
        return text

    def _parse_clauses_json(self, raw_text: str) -> List[Dict[str, Any]]:
        """
        Parse JSON response from AI clause analysis with robust error recovery.
        
        Recovery strategy:
        1. Extract from markdown if present
        2. Try direct JSON parsing
        3. Try balanced bracket extraction
        4. Try cleaning and retrying
        5. Validate and normalize output
        """
        import json
        import re
        
        corr_id = self._get_corr_id()
        
        # Handle empty or whitespace-only responses
        if not raw_text or not raw_text.strip():
            logger.warning(f"[{corr_id}] Empty response received from AI provider")
            raise ValueError("Empty response from AI provider")
        
        # Step 1: Extract from markdown if present
        cleaned = self._extract_from_markdown(raw_text)
        
        # Step 2: Try direct JSON parsing
        try:
            parsed = json.loads(cleaned)
            if isinstance(parsed, list):
                logger.info(f"[{corr_id}] Successfully parsed JSON directly")
                return self._validate_and_normalize_clauses(parsed)
            logger.debug(f"[{corr_id}] Parsed JSON is not a list, type: {type(parsed)}")
        except json.JSONDecodeError as e:
            logger.debug(f"[{corr_id}] Direct JSON parsing failed: {e}")
        
        # Step 3: Try balanced bracket extraction
        json_array = self._extract_json_array_balanced(cleaned)
        if json_array:
            logger.info(f"[{corr_id}] Extracted JSON array using balanced bracket parsing")
            try:
                parsed = json.loads(json_array)
                if isinstance(parsed, list):
                    return self._validate_and_normalize_clauses(parsed)
            except json.JSONDecodeError as e:
                logger.debug(f"[{corr_id}] Balanced bracket extraction failed to parse: {e}")
        
        # Step 4: Try cleaning common issues and retry
        cleaned_json = self._clean_json_string(cleaned)
        try:
            parsed = json.loads(cleaned_json)
            if isinstance(parsed, list):
                logger.info(f"[{corr_id}] Successfully parsed after cleaning JSON string")
                return self._validate_and_normalize_clauses(parsed)
        except json.JSONDecodeError as e:
            logger.debug(f"[{corr_id}] Cleaned JSON parsing failed: {e}")
        
        # Step 5: Try balanced bracket extraction on cleaned string
        json_array = self._extract_json_array_balanced(cleaned_json)
        if json_array:
            logger.info(f"[{corr_id}] Extracted JSON array from cleaned string")
            try:
                parsed = json.loads(json_array)
                if isinstance(parsed, list):
                    return self._validate_and_normalize_clauses(parsed)
            except json.JSONDecodeError as e:
                logger.debug(f"[{corr_id}] Cleaned balanced bracket extraction failed: {e}")
        
        # Step 6: Fallback to legacy regex extraction (for backward compatibility)
        try:
            array_match = re.search(r"\[\s*\{[\s\S]*\}\s*\]", cleaned)
            if array_match:
                logger.info(f"[{corr_id}] Using legacy regex extraction as fallback")
                parsed = json.loads(array_match.group(0))
                if isinstance(parsed, list):
                    return self._validate_and_normalize_clauses(parsed)
        except Exception as e:
            logger.debug(f"[{corr_id}] Legacy regex extraction failed: {e}")
        
        # All extraction attempts failed
        logger.error(
            f"[{corr_id}] All JSON extraction methods failed. "
            f"Response length: {len(raw_text)}, "
            f"Starts with bracket: {raw_text.strip().startswith('[')}, "
            f"Contains bracket: {'[' in raw_text}"
        )
        raise ValueError("Invalid JSON response from AI provider")

    def _validate_and_normalize_clauses(self, parsed: List[Any]) -> List[Dict[str, Any]]:
        """
        Validate and normalize clause objects from parsed JSON.
        Ensures consistent output format and valid risk levels.
        """
        validated_clauses = []
        
        for item in parsed:
            if not isinstance(item, dict):
                logger.debug(f"Skipping non-dict item in parsed list: {type(item)}")
                continue
            
            if "clause" not in item:
                logger.debug("Skipping item without 'clause' key")
                continue
            
            # Normalize risk level
            risk_lvl = str(item.get("riskLevel", "Low")).strip().capitalize()
            if risk_lvl not in ["High", "Medium", "Low"]:
                risk_lvl = "Low"
                logger.debug(f"Normalized invalid riskLevel to 'Low'")
            
            validated_clauses.append({
                "clause": str(item.get("clause", "")).strip(),
                "riskLevel": risk_lvl,
                "riskReason": str(item.get("riskReason", "")).strip() or "Analyzed clause."
            })
        
        if not validated_clauses:
            logger.warning("No valid clauses found after validation")
        
        return validated_clauses

    def check_health(self) -> Dict[str, Any]:
        """
        Return a public-safe health status, with optional debug diagnostics.
        """
        status = "ok"
        if not self.client and not self.stub_mode:
            status = "degraded"

        settings = get_settings()
        if settings.ai.health_debug:
            details = {
                "bytez": bool(self.client),
                "initialized": bool(self.client),
                "stub_mode": self.stub_mode,
                "graceful_degradation": self.graceful_degradation,
                "chat_model": self.chat_model_name,
                "summarize_model": self.summarize_model_name,
            }
            return {"status": status, "details": details}

        # Always include details for stub mode to support tests
        if self.stub_mode:
            return {"status": status, "details": {"stub_mode": True}}

        return {"status": status}



# Global singleton instance
ai_service = AIService()
