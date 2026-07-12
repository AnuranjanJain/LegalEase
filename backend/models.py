from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from backend.database import Base
from backend.core.encryption import EncryptedText


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)

    chat_sessions = relationship("ChatSession", back_populates="user", cascade="all, delete-orphan")
    documents = relationship("DocumentRecord", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    obligations = relationship("Obligation", cascade="all, delete-orphan")


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String, default="New Chat")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="chat_sessions")
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan", order_by="ChatMessage.created_at")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("chat_sessions.id"), nullable=False, index=True)
    role = Column(String, nullable=False)  # 'user' or 'assistant'
    content = Column(EncryptedText, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Conversation branching support (#366):
    # parent_id points to the message this one was generated in response to,
    # enabling a tree structure rather than a flat list.
    parent_id = Column(Integer, ForeignKey("chat_messages.id"), nullable=True, index=True)
    # branch_index tracks which regeneration/edit variant this message represents (0-based).
    branch_index = Column(Integer, nullable=False, default=0)

    session = relationship("ChatSession", back_populates="messages")
    children = relationship("ChatMessage", backref=__import__('sqlalchemy.orm', fromlist=['backref']).backref("parent", remote_side=[id]))


class DocumentRecord(Base):
    __tablename__ = "document_records"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    filename = Column(String, nullable=False)
    file_type = Column(String, nullable=True)
    summary = Column(EncryptedText, nullable=True)
    clause_analysis = Column(EncryptedText, nullable=True)
    analyzed_at = Column(DateTime, nullable=True) 
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="documents")


class RevokedToken(Base):
    """
    Stores revoked JWT IDs (jti claims) so that logged-out tokens
    cannot be reused within their original expiry window.
    Rows whose `expires_at` is in the past are safe to purge.
    """
    __tablename__ = "revoked_tokens"

    id = Column(Integer, primary_key=True, index=True)
    jti = Column(String, nullable=False, unique=True, index=True)
    expires_at = Column(DateTime, nullable=False)
    revoked_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (UniqueConstraint("jti", name="uq_revoked_tokens_jti"),)


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    type = Column(String, nullable=False, default="system")  # 'document', 'security', 'system'
    read = Column(Integer, default=0)  # 0 = unread, 1 = read
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="notifications")

class Obligation(Base):
    """
    A single extracted deadline/obligation tied to a document, forming a
    per-user ledger of upcoming legal deadlines across their portfolio.
    Populated from /legal/extract-deadlines when a document_id is supplied.
    """
    __tablename__ = "obligations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    document_id = Column(Integer, ForeignKey("document_records.id"), nullable=False, index=True)
    title = Column(String, nullable=False)
    due_date = Column(DateTime, nullable=False, index=True)
    description = Column(String, nullable=True)
    # 'pending' (default) | 'completed' | 'dismissed'
    status = Column(String, nullable=False, default="pending", index=True)
    # Tracks which reminder thresholds (30/15/1 day) have already fired,
    # so the reminder job never sends the same threshold twice.
    # Stored as a comma-separated string of ints, e.g. "30,15".
    reminder_sent_stage = Column(String, nullable=False, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")
    document = relationship("DocumentRecord")

class Feedback(Base):
    __tablename__ = "feedback"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    response_type = Column(String, nullable=False)
    rating = Column(String, nullable=False)
    category = Column(String, nullable=True)
    message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")