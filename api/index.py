from fastapi import FastAPI

from backend.main import app as backend_app


app = FastAPI()
app.mount("/api", backend_app)
