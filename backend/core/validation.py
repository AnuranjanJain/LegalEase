import os
import re
import zipfile
import io
from typing import Optional
from backend.core.exceptions import ValidationError

# Configuration limits with fallback defaults
MAX_CHAT_INPUT_CHARS = int(os.getenv("MAX_CHAT_INPUT_CHARS", "4000"))
MAX_SUMMARIZE_INPUT_CHARS = int(os.getenv("MAX_SUMMARIZE_INPUT_CHARS", "20000"))
MAX_CONTEXT_INPUT_CHARS = int(os.getenv("MAX_CONTEXT_INPUT_CHARS", "10000"))

# Resource hardening limits for document parsing
MAX_PDF_PAGES = int(os.getenv("MAX_PDF_PAGES", "500"))
MAX_DOCX_PARAGRAPHS = int(os.getenv("MAX_DOCX_PARAGRAPHS", "10000"))
MAX_ZIP_COMPRESSION_RATIO = int(os.getenv("MAX_ZIP_COMPRESSION_RATIO", "100"))
MAX_ZIP_UNCOMPRESSED_SIZE = int(os.getenv("MAX_ZIP_UNCOMPRESSED_SIZE", "50000000"))  # 50MB
MAX_EXTRACTED_TEXT_CHARS = int(os.getenv("MAX_EXTRACTED_TEXT_CHARS", "500000"))  # 500K chars


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
        # 3. DOCX archive hardening (zip bomb protection)
        validate_docx_archive(content)


def validate_docx_archive(content: bytes):
    """
    Validate DOCX archive structure to prevent zip bombs and resource exhaustion.
    Checks compression ratios, uncompressed size, and entry counts.
    """
    try:
        with zipfile.ZipFile(io.BytesIO(content), 'r') as zf:
            total_compressed = 0
            total_uncompressed = 0
            entry_count = 0
            
            for info in zf.infolist():
                entry_count += 1
                total_compressed += info.compress_size
                total_uncompressed += info.file_size
                
                # Check individual file size
                if info.file_size > MAX_ZIP_UNCOMPRESSED_SIZE:
                    raise ValidationError(
                        f"DOCX archive contains entry exceeding maximum size "
                        f"({info.file_size} bytes > {MAX_ZIP_UNCOMPRESSED_SIZE} bytes)"
                    )
                
                # Check for suspicious compression ratio (potential zip bomb)
                if info.compress_size > 0 and info.file_size > 0:
                    ratio = info.file_size / info.compress_size
                    if ratio > MAX_ZIP_COMPRESSION_RATIO:
                        raise ValidationError(
                            f"DOCX archive has suspicious compression ratio "
                            f"({ratio:.1f}x > {MAX_ZIP_COMPRESSION_RATIO}x) - possible zip bomb"
                        )
            
            # Check total uncompressed size
            if total_uncompressed > MAX_ZIP_UNCOMPRESSED_SIZE:
                raise ValidationError(
                    f"DOCX archive total uncompressed size exceeds limit "
                    f"({total_uncompressed} bytes > {MAX_ZIP_UNCOMPRESSED_SIZE} bytes)"
                )
                
            # Check total compression ratio
            if total_compressed > 0:
                total_ratio = total_uncompressed / total_compressed
                if total_ratio > MAX_ZIP_COMPRESSION_RATIO:
                    raise ValidationError(
                        f"DOCX archive has suspicious total compression ratio "
                        f"({total_ratio:.1f}x > {MAX_ZIP_COMPRESSION_RATIO}x)"
                    )
                    
    except zipfile.BadZipFile:
        raise ValidationError("DOCX file is corrupted or not a valid ZIP archive")
    except ValidationError:
        raise
    except Exception as e:
        raise ValidationError(f"Failed to validate DOCX archive: {str(e)}")
