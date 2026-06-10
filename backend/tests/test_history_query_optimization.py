"""
Tests for profiling and optimizing chat history query patterns.

This test suite analyzes the N+1 query pattern in session listing
and validates the optimization.
"""
import pytest
import time
from sqlalchemy.orm import Session
from sqlalchemy import event
from sqlalchemy.engine import Engine

from backend.database import Base, engine, SessionLocal
from backend import models


# Track query count for profiling
query_count = 0


@event.listens_for(Engine, "before_cursor_execute")
def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    global query_count
    query_count += 1


@pytest.fixture(autouse=True)
def reset_query_count():
    """Reset query count before each test."""
    global query_count
    query_count = 0
    yield
    query_count = 0


@pytest.fixture
def db_session():
    """Create a fresh database session for each test."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def test_user(db_session):
    """Create a test user."""
    user = models.User(email="test@example.com", hashed_password="hashed")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def test_data_with_sessions(db_session, test_user):
    """Create test data with multiple sessions and messages."""
    sessions = []
    for i in range(10):
        session = models.ChatSession(
            user_id=test_user.id,
            title=f"Session {i}"
        )
        db_session.add(session)
        db_session.flush()
        
        # Add varying numbers of messages to each session
        message_count = (i + 1) * 5  # 5, 10, 15, ... 50 messages
        for j in range(message_count):
            message = models.ChatMessage(
                session_id=session.id,
                role="user" if j % 2 == 0 else "assistant",
                content=f"Message {j} in session {i}"
            )
            db_session.add(message)
        
        sessions.append(session)
    
    db_session.commit()
    return sessions


@pytest.mark.unit
def test_current_query_pattern(db_session, test_user, test_data_with_sessions):
    """Profile current query pattern to identify N+1 issue."""
    global query_count
    
    # Simulate the current implementation
    sessions = (
        db_session.query(models.ChatSession)
        .filter(models.ChatSession.user_id == test_user.id)
        .order_by(models.ChatSession.updated_at.desc())
        .all()
    )
    
    initial_queries = query_count
    
    # Access messages in loop (this triggers N+1)
    result = []
    for s in sessions:
        message_count = len(s.messages) if s.messages else 0
        result.append({
            "id": s.id,
            "title": s.title,
            "message_count": message_count
        })
    
    total_queries = query_count
    additional_queries = total_queries - initial_queries
    
    # With 10 sessions, we expect 1 initial query + 10 lazy load queries = 11 total
    # This confirms the N+1 pattern
    print(f"\nInitial queries: {initial_queries}")
    print(f"Total queries: {total_queries}")
    print(f"Additional queries (lazy loads): {additional_queries}")
    print(f"Number of sessions: {len(sessions)}")
    
    # This will fail initially, showing the N+1 problem
    assert additional_queries == len(sessions), "N+1 query pattern detected"


@pytest.mark.unit
def test_optimized_with_selectinload(db_session, test_user, test_data_with_sessions):
    """Test optimization using selectinload."""
    from sqlalchemy.orm import selectinload
    global query_count
    
    # Optimized query with selectinload
    sessions = (
        db_session.query(models.ChatSession)
        .options(selectinload(models.ChatSession.messages))
        .filter(models.ChatSession.user_id == test_user.id)
        .order_by(models.ChatSession.updated_at.desc())
        .all()
    )
    
    initial_queries = query_count
    
    # Access messages in loop (should not trigger additional queries)
    result = []
    for s in sessions:
        message_count = len(s.messages) if s.messages else 0
        result.append({
            "id": s.id,
            "title": s.title,
            "message_count": message_count
        })
    
    total_queries = query_count
    additional_queries = total_queries - initial_queries
    
    print(f"\nOptimized with selectinload:")
    print(f"Initial queries: {initial_queries}")
    print(f"Total queries: {total_queries}")
    print(f"Additional queries: {additional_queries}")
    
    # With selectinload, we expect 2 queries total (1 for sessions, 1 for messages)
    assert total_queries <= 2, "selectinload should eliminate N+1 queries"


@pytest.mark.unit
def test_optimized_with_subquery_count(db_session, test_user, test_data_with_sessions):
    """Test optimization using subquery for counting."""
    from sqlalchemy import func
    global query_count
    
    # Reset query count before the actual query
    query_count = 0
    
    # Optimized query using subquery for counting
    message_counts = (
        db_session.query(
            models.ChatMessage.session_id,
            func.count(models.ChatMessage.id).label('msg_count')
        )
        .group_by(models.ChatMessage.session_id)
        .subquery()
    )
    
    sessions = (
        db_session.query(models.ChatSession, message_counts.c.msg_count)
        .outerjoin(message_counts, models.ChatSession.id == message_counts.c.session_id)
        .filter(models.ChatSession.user_id == test_user.id)
        .order_by(models.ChatSession.updated_at.desc())
        .all()
    )
    
    total_queries = query_count
    
    # Build result without accessing messages relationship
    result = []
    for s, count in sessions:
        result.append({
            "id": s.id,
            "title": s.title,
            "message_count": count if count else 0
        })
    
    print(f"\nOptimized with subquery count:")
    print(f"Total queries: {total_queries}")
    print(f"Number of sessions: {len(sessions)}")
    
    # Should be 2 queries (subquery + main query), which is much better than N+1
    assert total_queries <= 2, "Subquery count should use at most 2 queries"


@pytest.mark.performance
def test_performance_comparison(db_session, test_user):
    """Compare performance of different approaches."""
    # Create larger dataset
    sessions = []
    for i in range(50):
        session = models.ChatSession(
            user_id=test_user.id,
            title=f"Session {i}"
        )
        db_session.add(session)
        db_session.flush()
        
        for j in range(20):  # 20 messages per session
            message = models.ChatMessage(
                session_id=session.id,
                role="user" if j % 2 == 0 else "assistant",
                content=f"Message {j} in session {i}"
            )
            db_session.add(message)
        
        sessions.append(session)
    
    db_session.commit()
    
    # Test current approach
    global query_count
    query_count = 0
    
    start = time.time()
    sessions_data = (
        db_session.query(models.ChatSession)
        .filter(models.ChatSession.user_id == test_user.id)
        .order_by(models.ChatSession.updated_at.desc())
        .all()
    )
    
    for s in sessions_data:
        _ = len(s.messages)
    
    current_time = time.time() - start
    current_queries = query_count
    
    # Test optimized approach with subquery
    from sqlalchemy import func
    query_count = 0
    
    start = time.time()
    message_counts = (
        db_session.query(
            models.ChatMessage.session_id,
            func.count(models.ChatMessage.id).label('msg_count')
        )
        .group_by(models.ChatMessage.session_id)
        .subquery()
    )
    
    sessions_optimized = (
        db_session.query(models.ChatSession, message_counts.c.msg_count)
        .outerjoin(message_counts, models.ChatSession.id == message_counts.c.session_id)
        .filter(models.ChatSession.user_id == test_user.id)
        .order_by(models.ChatSession.updated_at.desc())
        .all()
    )
    
    for s, count in sessions_optimized:
        _ = count if count else 0
    
    optimized_time = time.time() - start
    optimized_queries = query_count
    
    print(f"\nPerformance Comparison (50 sessions, 1000 messages):")
    print(f"Current approach: {current_queries} queries, {current_time:.4f}s")
    print(f"Optimized approach: {optimized_queries} queries, {optimized_time:.4f}s")
    print(f"Query reduction: {((current_queries - optimized_queries) / current_queries * 100):.1f}%")
    print(f"Time reduction: {((current_time - optimized_time) / current_time * 100):.1f}%")
    
    # Optimized should be significantly better
    assert optimized_queries < current_queries, "Optimization should reduce queries"
    assert optimized_time < current_time, "Optimization should improve performance"
