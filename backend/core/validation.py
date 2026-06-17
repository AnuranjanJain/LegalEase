import os
import re
import zipfile
from typing import Optional
from backend.core.exceptions import ValidationError
from backend.core.jurisdictions import Jurisdictions

# Configuration limits with fallback defaults
MAX_CHAT_INPUT_CHARS = int(os.getenv("MAX_CHAT_INPUT_CHARS", "4000"))
MAX_SUMMARIZE_INPUT_CHARS = int(os.getenv("MAX_SUMMARIZE_INPUT_CHARS", "20000"))
MAX_SIMPLIFY_INPUT_CHARS = int(os.getenv("MAX_SIMPLIFY_INPUT_CHARS", "10000"))
MAX_CONTEXT_INPUT_CHARS = int(os.getenv("MAX_CONTEXT_INPUT_CHARS", "10000"))
MAX_DOCX_ARCHIVE_ENTRIES = int(os.getenv("MAX_DOCX_ARCHIVE_ENTRIES", "200"))
MAX_DOCX_ARCHIVE_UNCOMPRESSED_BYTES = int(os.getenv("MAX_DOCX_ARCHIVE_UNCOMPRESSED_BYTES", str(10 * 1024 * 1024)))
MAX_DOCX_ARCHIVE_ENTRY_BYTES = int(os.getenv("MAX_DOCX_ARCHIVE_ENTRY_BYTES", str(5 * 1024 * 1024)))
MAX_DOCX_ARCHIVE_RATIO = float(os.getenv("MAX_DOCX_ARCHIVE_RATIO", "100"))
MAX_DOCX_XML_BYTES = int(os.getenv("MAX_DOCX_XML_BYTES", str(5 * 1024 * 1024)))


def validate_chat_input(message: str, context: Optional[str] = None):
    """
    Validate the chat request inputs.
    Rejects early if character counts exceed safe limits.
    """
    if not message or not message.strip():
        raise ValidationError("Chat message cannot be empty or only whitespace")
        
    if len(message) > MAX_CHAT_INPUT_CHARS:
        raise ValidationError(f"Chat message exceeds the maximum allowed length of {MAX_CHAT_INPUT_CHARS} characters")
        
    if context and len(context) > MAX_CONTEXT_INPUT_CHARS:
        raise ValidationError(f"Document context exceeds the maximum allowed length of {MAX_CONTEXT_INPUT_CHARS} characters")


def validate_summarize_input(text: str):
    """
    Validate the summarization text.
    Rejects early if character counts exceed safe limits.
    """
    if not text or not text.strip():
        raise ValidationError("Text to summarize cannot be empty or only whitespace")
        
    if len(text) > MAX_SUMMARIZE_INPUT_CHARS:
        raise ValidationError(f"Text to summarize exceeds the maximum allowed length of {MAX_SUMMARIZE_INPUT_CHARS} characters")


def validate_simplify_input(text: str):
    """
    Validate the text to simplify.
    Rejects early if character counts exceed safe limits.
    """
    if not text or not text.strip():
        raise ValidationError("Text to simplify cannot be empty or only whitespace")
        
    if len(text) > MAX_SIMPLIFY_INPUT_CHARS:
        raise ValidationError(f"Text to simplify exceeds the maximum allowed length of {MAX_SIMPLIFY_INPUT_CHARS} characters")


def sanitize_text(text: str) -> str:
    """
    Sanitize text to prevent malicious injections or formatting issues.
    Removes HTML tags and cleans up excessive white spaces.
    """
    if not text:
        return ""
    # Strip basic HTML tags
    clean = re.sub(r'<[^>]*>', '', text)
    # Strip excessive consecutive blank lines
    clean = re.sub(r'\n{3,}', '\n\n', clean)
    return clean.strip()


def validate_mime_and_bytes(content: bytes, content_type: str, filename: str):
    """
    Perform MIME-aware preprocessing and validation on file uploads.
    Throws ValidationError if mismatch or corruption detected.
    """
    file_extension = os.path.splitext(filename)[1].lower()
    
    # 1. MIME-type validation
    allowed_mimes = {
        ".pdf": ["application/pdf"],
        ".docx": ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
        ".txt": ["text/plain"]
    }
    
    if file_extension not in allowed_mimes:
        raise ValidationError(f"Unsupported file extension '{file_extension}'")
        
    # Standardize content_type and accept octet-stream for safety
    if content_type not in allowed_mimes[file_extension] and content_type != "application/octet-stream" and content_type != "":
        raise ValidationError(f"MIME type '{content_type}' does not match file extension '{file_extension}'")
        
    # 2. Magic bytes / simple signature validation
    if file_extension == ".pdf":
        if not content.startswith(b"%PDF-"):
            raise ValidationError("File content signature does not match PDF structure")
    elif file_extension == ".docx":
        if not content.startswith(b"PK\x03\x04"):
            raise ValidationError("File content signature does not match DOCX structure (ZIP archive)")

def validate_docx_archive_safety(file_path: str):
    """
    Inspect DOCX archives for obvious zip-bomb and abuse patterns before parsing.
    Accepts file path to avoid loading entire file into memory.
    """
    try:
        with zipfile.ZipFile(file_path) as archive:
            members = archive.infolist()
            if len(members) > MAX_DOCX_ARCHIVE_ENTRIES:
                raise ValidationError("DOCX archive contains too many files")

            total_uncompressed_size = 0
            total_compressed_size = 0
            document_xml_size = 0

            for member in members:
                if member.file_size < 0 or member.compress_size < 0:
                    raise ValidationError("DOCX archive contains invalid file metadata")

                total_uncompressed_size += member.file_size
                total_compressed_size += member.compress_size

                if member.file_size > MAX_DOCX_ARCHIVE_ENTRY_BYTES:
                    raise ValidationError("DOCX archive contains an oversized embedded file")

                if member.filename.endswith("document.xml"):
                    document_xml_size = max(document_xml_size, member.file_size)

            if total_uncompressed_size > MAX_DOCX_ARCHIVE_UNCOMPRESSED_BYTES:
                raise ValidationError("DOCX archive is too large to process safely")

            if document_xml_size > MAX_DOCX_XML_BYTES:
                raise ValidationError("DOCX document content is too large to process safely")

            if total_compressed_size > 0 and total_uncompressed_size / total_compressed_size > MAX_DOCX_ARCHIVE_RATIO:
                raise ValidationError("DOCX archive compression ratio is suspiciously high")
    except zipfile.BadZipFile:
        raise ValidationError("File content signature does not match DOCX structure (ZIP archive)")


MAX_EXPORT_TITLE_CHARS = 200
MAX_EXPORT_SUMMARY_CHARS = 100000
MAX_EXPORT_CHAT_MESSAGES = 500
MAX_EXPORT_CHAT_MSG_CHARS = 20000


def validate_export_pdf_input(title: str, summary: Optional[str] = None, chat_history: Optional[list] = None):
    """
    Validate the PDF export request payload.
    Ensures safe character limits and correct structured formatting.
    """
    if not title or not title.strip():
        raise ValidationError("Report title cannot be empty")
        
    if len(title) > MAX_EXPORT_TITLE_CHARS:
        raise ValidationError(f"Report title exceeds the maximum allowed length of {MAX_EXPORT_TITLE_CHARS} characters")
        
    has_summary = bool(summary and summary.strip())
    has_chat = bool(chat_history and len(chat_history) > 0)
    
    if not has_summary and not has_chat:
        raise ValidationError("Both summary and chat history cannot be empty")
        
    if has_summary and len(summary) > MAX_EXPORT_SUMMARY_CHARS:
        raise ValidationError(f"Summary text exceeds the maximum allowed length of {MAX_EXPORT_SUMMARY_CHARS} characters")
        
    if has_chat:
        if len(chat_history) > MAX_EXPORT_CHAT_MESSAGES:
            raise ValidationError(f"Chat history exceeds the maximum allowed count of {MAX_EXPORT_CHAT_MESSAGES} messages")
            
        for idx, item in enumerate(chat_history):
            if not isinstance(item, dict):
                raise ValidationError(f"Chat message at index {idx} must be a dictionary")
            role = item.get("role")
            content = item.get("content")
            
            if role not in ("user", "assistant", "bot"):
                raise ValidationError(f"Chat message role at index {idx} must be 'user', 'assistant', or 'bot'")
                
            if not content or not content.strip():
                raise ValidationError(f"Chat message content at index {idx} cannot be empty")
                
            if len(content) > MAX_EXPORT_CHAT_MSG_CHARS:
                raise ValidationError(f"Chat message content at index {idx} exceeds the maximum allowed length of {MAX_EXPORT_CHAT_MSG_CHARS} characters")


def validate_jurisdiction(jurisdiction: str):
    """
    Validate that the supplied jurisdiction is supported by the system.
    """
    if not jurisdiction or jurisdiction.strip() == "":
        raise ValidationError("Jurisdiction cannot be empty")
    
    if jurisdiction not in Jurisdictions.ALL:
        raise ValidationError(f"Unsupported jurisdiction: '{jurisdiction}'")

