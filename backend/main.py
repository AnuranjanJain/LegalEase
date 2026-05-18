from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from bytez import Bytez
import os
import logging
import fitz  # PyMuPDF
import base64
from typing import Optional, List
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

app = FastAPI()

# Enable CORS for frontend communication
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Bytez SDK
BYTEZ_API_KEY = os.getenv("BYTEZ_API_KEY")
if not BYTEZ_API_KEY:
    logger.error("BYTEZ_API_KEY not found in environment variables")
    raise RuntimeError("BYTEZ_API_KEY is required")

client = Bytez(BYTEZ_API_KEY)
logger.info("Bytez client initialized")

class ChatRequest(BaseModel):
    message: str
    context: Optional[str] = None

class SummarizeRequest(BaseModel):
    text: str

@app.post("/chat")
async def chat(request: ChatRequest):
    try:
        model = client.model("inference-net/Schematron-3B")
        
        # Build prompt with context if available
        prompt = request.message
        if request.context:
            prompt = f"Context from document:\n{request.context}\n\nUser Question: {request.message}"

        messages = [
            {
                "role": "user",
                "content": prompt
            }
        ]
        
        output = model.run(messages)
        
        if hasattr(output, 'error') and output.error:
            logger.error(f"Model error: {output.error}")

            raise HTTPException(
                status_code=503,
                detail="AI chatbot service is currently unavailable."
            )

        return {"response": output.output}
    except Exception as e:
        logger.error(
            f"Error processing chat request: {str(e)}",
            exc_info=True
        )

        raise HTTPException(
            status_code=503,
            detail="AI chatbot service is currently unavailable."
        )

@app.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    try:
        content = await file.read()
        file_extension = os.path.splitext(file.filename)[1].lower()
        extracted_text = ""

        if file_extension == '.pdf':
            doc = fitz.open(stream=content, filetype="pdf")
            for page in doc:
                extracted_text += page.get_text()
        elif file_extension in ['.jpg', '.jpeg', '.png']:
            # Use Bytez OCR for images
            ocr_model = client.model("DeepDiveDev/transformodocs-ocr")
            # Convert to base64 if needed by the model
            encoded_image = base64.b64encode(content).decode('utf-8')
            output = ocr_model.run({"image": encoded_image})
            extracted_text = output.output if hasattr(output, 'output') else str(output)
        else:
            extracted_text = content.decode('utf-8')

        return {
            "filename": file.filename,
            "text": extracted_text[:10000] # Limit context for now
        }
    except Exception as e:
        logger.error(f"Upload error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to process document: {str(e)}")

@app.post("/summarize")
async def summarize(request: SummarizeRequest):
    try:
        # Use a summarization model from Bytez
        # Note: Adjusting model name if "inference-net/Schematron-3B" is better as a generalist
        summary_model = client.model("Jnjnpx/fine-tuned-bert-extractive-summarization")
        
        output = summary_model.run(request.text[:512]) # Model specific limit usually
        
        return {"summary": output.output if hasattr(output, 'output') else str(output)}
    except Exception as e:
        logger.error(f"Summarization error: {e}", exc_info=True)
        # Fallback to general model if specialized summarizer fails
        try:
             model = client.model("inference-net/Schematron-3B")
             prompt = f"Summarize this legal text concisely:\n\n{request.text[:2000]}"
             output = model.run([{"role": "user", "content": prompt}])
             return {"summary": output.output}
        except:
             raise HTTPException(status_code=500, detail="Failed to generate summary.")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
