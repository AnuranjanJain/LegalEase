from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from bytez import Bytez
import os

app = FastAPI()

# Enable CORS for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify the frontend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Bytez SDK
# Note: Ideally, API keys should be in environment variables
BYTEZ_API_KEY = "e325b7828cb5f91833af35c7737e19bd"
client = Bytez(BYTEZ_API_KEY)

class ChatRequest(BaseModel):
    message: str

@app.post("/chat")
async def chat(request: ChatRequest):
    try:
        model = client.model("inference-net/Schematron-3B")
        
        # Prepare input for the model
        messages = [
            {
                "role": "user",
                "content": request.message
            }
        ]
        
        # Run inference
        output = model.run(messages)
        
        if hasattr(output, 'error') and output.error:
             raise HTTPException(status_code=500, detail=f"Model error: {output.error}")

        # The output structure from Bytez might vary, adjusting based on documentation/examples
        # Assuming output.output contains the response text or structure
        return {"response": output.output}

    except Exception as e:
        print(f"Error processing request: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
