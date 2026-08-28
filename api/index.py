"""Vercel ASGI entry point.

The wrapper keeps the public URL contract at ``/api/*`` while the backend
application owns the framework routes below that prefix.
"""

from fastapi import FastAPI

from backend.main import app as backend_app


app = FastAPI()
app.mount("/api", backend_app)
