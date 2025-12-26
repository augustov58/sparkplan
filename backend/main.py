from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import settings
import logging

# Configure logging
logging.basicConfig(
    level=settings.log_level,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="NEC Pro Compliance - AI Agent API",
    description="Pydantic AI-powered agent orchestration for electrical project management",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "online",
        "service": "NEC Pro Compliance AI Agent API",
        "environment": settings.environment
    }


@app.get("/health")
async def health_check():
    """Detailed health check"""
    return {
        "status": "healthy",
        "environment": settings.environment,
        "services": {
            "supabase": "connected" if settings.supabase_url else "not configured",
            "gemini": "configured" if settings.google_api_key else "not configured"
        }
    }


# Import and include routers
from routes import agent_actions
app.include_router(agent_actions.router, prefix="/api", tags=["agent-actions"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.port,
        reload=settings.environment == "development"
    )
