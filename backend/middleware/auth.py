from fastapi import HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase import create_client, Client
from config import settings
import logging

logger = logging.getLogger(__name__)

security = HTTPBearer()

# Initialize Supabase client
supabase: Client = create_client(settings.supabase_url, settings.supabase_service_key)


async def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)) -> dict:
    """
    Validate Supabase JWT token and return user info

    Args:
        credentials: HTTP Authorization credentials with JWT token

    Returns:
        dict: User information from Supabase

    Raises:
        HTTPException: If token is invalid or expired
    """
    token = credentials.credentials

    try:
        # Verify JWT token with Supabase
        logger.info(f"Validating token: {token[:20]}...")
        response = supabase.auth.get_user(token)
        logger.info(f"Auth response type: {type(response)}")
        logger.info(f"Auth response: {response}")

        if not response or not response.user:
            logger.error("No user in auth response")
            raise HTTPException(
                status_code=401,
                detail="Invalid authentication credentials"
            )

        user = response.user
        logger.info(f"User authenticated: {user.email}")

        return {
            "id": user.id,
            "email": user.email,
            "user_metadata": user.user_metadata
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Authentication error: {type(e).__name__}: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=401,
            detail=f"Could not validate credentials: {str(e)}"
        )


def get_supabase_client() -> Client:
    """
    Get Supabase client instance

    Returns:
        Client: Supabase client
    """
    return supabase
