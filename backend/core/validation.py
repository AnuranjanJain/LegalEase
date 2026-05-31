import os
import re
import zipfile
from typing import Optional
from backend.core.exceptions import ValidationError

# Configuration limits with fallback defaults
MAX_CHAT_INPUT_CHARS = int(os.getenv("MAX_CHAT_INPUT_CHARS", "4000"))
MAX_SUMMARIZE_INPUT_CHARS = int(os.getenv("MAX_SUMMARIZE_INPUT_CHARS", "20000"))
MAX_CONTEXT_INPUT_CHARS = int(os.getenv("MAX_CONTEXT_INPUT_CHARS", "10000"))
MAX_DOCX_ARCHIVE_ENTRIES = int(os.getenv("MAX_DOCX_ARCHIVE_ENTRIES", "200"))
MAX_DOCX_ARCHIVE_UNCOMPRESSED_BYTES = int(os.getenv("MAX_DOCX_ARCHIVE_UNCOMPRESSED_BYTES", str(10 * 1024 * 1024)))
MAX_DOCX_ARCHIVE_ENTRY_BYTES = int(os.getenv("MAX_DOCX_ARCHIVE_ENTRY_BYTES", str(5 * 1024 * 1024)))
MAX_DOCX_ARCHIVE_COMPRESSION_RATIO = float(os.getenv("MAX_DOCX_ARCHIVE_COMPRESSION_RATIO", "100"))


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
    Inspect a DOCX archive for obvious abuse patterns before parsing.
    """
    try:
        with zipfile.ZipFile(file_path) as archive:
            entries = archive.infolist()
            if len(entries) > MAX_DOCX_ARCHIVE_ENTRIES:
                raise ValidationError("DOCX archive contains too many files")

            total_uncompressed_size = 0
            for entry in entries:
                total_uncompressed_size += entry.file_size
                if entry.file_size > MAX_DOCX_ARCHIVE_ENTRY_BYTES:
                    raise ValidationError("DOCX archive contains an oversized embedded file")
                if entry.compress_size > 0 and (entry.file_size / entry.compress_size) > MAX_DOCX_ARCHIVE_COMPRESSION_RATIO:
                    raise ValidationError("DOCX archive compression ratio is suspiciously high")
                if total_uncompressed_size > MAX_DOCX_ARCHIVE_UNCOMPRESSED_BYTES:
                    raise ValidationError("DOCX archive is too large to process safely")
    except zipfile.BadZipFile:
        raise ValidationError("DOCX archive is invalid or corrupted")
