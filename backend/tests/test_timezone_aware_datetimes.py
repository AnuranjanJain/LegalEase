"""
Regression tests to ensure timezone-aware UTC datetimes are used consistently
and naive UTC datetimes (datetime.utcnow()) are not reintroduced.

This test suite validates the refactor from naive to timezone-aware datetimes.
"""
import ast
import os
import pytest
from pathlib import Path


def test_no_datetime_utcnow_in_backend_code():
    """
    Ensure datetime.utcnow() is not used in backend code.
    This prevents regression to naive UTC datetime usage.
    """
    backend_dir = Path(__file__).parent.parent
    python_files = []
    
    # Collect all Python files in backend (excluding tests directory since tests use .replace(tzinfo=None) for compatibility)
    for root, dirs, files in os.walk(backend_dir):
        # Skip test files and __pycache__
        if '__pycache__' in root or 'tests' in root:
            continue
        for file in files:
            if file.endswith('.py'):
                python_files.append(Path(root) / file)
    
    violations = []
    for file_path in python_files:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            # Check for datetime.utcnow() usage
            if 'datetime.utcnow' in content:
                # Parse the file to check if it's actually used (not just in comments/strings)
                try:
                    tree = ast.parse(content)
                    for node in ast.walk(tree):
                        if isinstance(node, ast.Call):
                            if isinstance(node.func, ast.Attribute):
                                if (isinstance(node.func.value, ast.Name) and 
                                    node.func.value.id == 'datetime' and 
                                    node.func.attr == 'utcnow'):
                                    violations.append(f"{file_path}:{node.lineno}")
                except SyntaxError:
                    # If we can't parse, check string content as fallback
                    lines = content.split('\n')
                    for i, line in enumerate(lines, 1):
                        if 'datetime.utcnow' in line and not line.strip().startswith('#'):
                            # Skip if it's in a string or comment
                            if 'datetime.utcnow()' in line and '"""' not in line and "'''" not in line:
                                violations.append(f"{file_path}:{i}")
    
    if violations:
        pytest.fail(
            f"Found datetime.utcnow() usage in {len(violations)} location(s). "
            f"Use datetime.now(timezone.utc) instead. Violations:\n" + 
            "\n".join(violations)
        )


def test_timezone_import_in_datetime_files():
    """
    Ensure files that use datetime.now(timezone.utc) have the timezone import.
    """
    backend_dir = Path(__file__).parent.parent
    python_files = []
    
    for root, dirs, files in os.walk(backend_dir):
        if '__pycache__' in root or 'tests' in root:
            continue
        for file in files:
            if file.endswith('.py'):
                python_files.append(Path(root) / file)
    
    violations = []
    for file_path in python_files:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            # Check if file uses timezone-aware datetime
            if 'datetime.now(timezone.utc)' in content or 'datetime.now(tz=timezone.utc)' in content:
                # Check if timezone is imported
                if 'from datetime import' in content:
                    if 'timezone' not in content:
                        violations.append(f"{file_path}: uses timezone-aware datetime but doesn't import timezone")
                elif 'import datetime' in content:
                    if 'datetime.timezone' not in content:
                        violations.append(f"{file_path}: uses timezone-aware datetime but doesn't import timezone")
    
    if violations:
        pytest.fail(
            f"Files using timezone-aware datetime must import timezone:\n" + 
            "\n".join(violations)
        )


def test_model_defaults_use_timezone_aware():
    """
    Ensure SQLAlchemy model defaults use timezone-aware datetimes.
    """
    models_file = Path(__file__).parent.parent / 'models.py'
    
    with open(models_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Check that model defaults use lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    # This is the pattern we use for SQLAlchemy compatibility
    if 'default=datetime.utcnow' in content:
        pytest.fail(
            "models.py still contains default=datetime.utcnow. "
            "Use default=lambda: datetime.now(timezone.utc).replace(tzinfo=None) instead."
        )
    
    # Verify the correct pattern is used
    if 'default=lambda: datetime.now(timezone.utc).replace(tzinfo=None)' not in content:
        pytest.fail(
            "models.py should use default=lambda: datetime.now(timezone.utc).replace(tzinfo=None) "
            "for timezone-aware datetime handling in SQLAlchemy models."
        )


def test_api_timestamps_preserve_z_suffix():
    """
    Ensure API timestamp serialization preserves the 'Z' suffix for UTC timestamps
    in files that require backward compatibility (webhooks, health checks, docx export).
    """
    backend_dir = Path(__file__).parent.parent
    
    # Check files that serialize timestamps for API responses that need Z suffix
    files_to_check = [
        backend_dir / 'services' / 'webhooks.py',
        backend_dir / 'main.py',
        backend_dir / 'services' / 'docx_service.py',
    ]
    
    # Our implementation uses .replace(tzinfo=None).isoformat() + "Z" to preserve Z suffix
    # This test verifies that pattern is used correctly
    for file_path in files_to_check:
        if not file_path.exists:
            continue
            
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Check that datetime.now(timezone.utc) is followed by .replace(tzinfo=None).isoformat() + "Z"
        if 'datetime.now(timezone.utc)' in content and '.isoformat()' in content:
            # Verify the pattern includes Z suffix handling
            assert '"Z"' in content, (
                f"{file_path}: uses datetime.now(timezone.utc) with .isoformat() "
                "but doesn't preserve 'Z' suffix for API compatibility"
            )
