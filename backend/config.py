from pydantic_settings import BaseSettings
from typing import List
from dotenv import load_dotenv

# Load .env file into os.environ BEFORE Settings is created
# This ensures GOOGLE_API_KEY is available when Pydantic AI agents are initialized
load_dotenv()


class Settings(BaseSettings):
    """Application configuration"""

    # Supabase
    supabase_url: str
    supabase_service_key: str

    # Google Gemini AI (Pydantic AI uses GOOGLE_API_KEY)
    google_api_key: str

    # Application
    environment: str = "development"
    port: int = 8000
    allowed_origins: List[str] = ["http://localhost:3000"]

    # Logging
    log_level: str = "INFO"

    class Config:
        env_file = ".env"
        case_sensitive = False


# Global settings instance
settings = Settings()
