from services import auth
from fastapi import APIRouter, Depends, Query, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from typing import Annotated, Literal, Optional
from datetime import timedelta
from core import models
from core.log import logger
from config import config
import secrets

router = APIRouter(prefix="/api/v1")

_oidc_states = {}

@router.get("/oidc/enabled")
async def oidc_enabled():
    """Check if OIDC is enabled."""
    return {
        "enabled": config.OIDC_ENABLED
    }


@router.get("/oidc/authorize")
async def oidc_authorize():
    """Get OIDC authorization URL to redirect user to provider."""
    if not config.OIDC_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OIDC authentication is not enabled"
        )
    
    try:
        from services.oidc_auth import OIDCAuth
        oidc = OIDCAuth()
        
        state = secrets.token_urlsafe(32)
        _oidc_states[state] = True

        auth_url = oidc.get_authorization_url(state)
        
        return {
            "authorization_url": auth_url,
            "state": state
        }
    except Exception as e:
        logger.error(f"Failed to generate OIDC URL: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OIDC not properly configured: {str(e)}"
        )


@router.get("/oidc/callback")
async def oidc_callback(
    code: str = Query(...),
    state: str = Query(...),
    error: Optional[str] = Query(None)
):
    """Handle OIDC callback - exchange code for token."""
    if not config.OIDC_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OIDC authentication is not enabled"
        )
    
    if error:
        logger.error(f"OIDC provider error: {error}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"OIDC authentication failed: {error}"
        )
    
    if state not in _oidc_states:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid state parameter"
        )
    _oidc_states.pop(state, None)
    
    try:
        from services.oidc_auth import OIDCAuth
        oidc = OIDCAuth()
        
        oidc_user = await oidc.authenticate(code)
        
        if not oidc_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="OIDC authentication failed"
            )

        # Pass raw IdP claims into login; authenticate_user maps once (roles, username).
        # Passing a pre-mapped UserInDB dict would run mapping again without realm_access / resource_access and break role mapping.
        token = auth.login(method="oidc", oidc_user_data=oidc_user)

        preview = oidc.map_oidc_user_to_db_user(oidc_user)
        db_user = auth.get_user(preview.username)
        if not db_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="OIDC authentication failed",
            )

        return {
            "access_token": token.access_token,
            "token_type": token.token_type,
            "refresh_token": token.refresh_token,
            "username": db_user.username,
            "role": db_user.role,
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"OIDC callback error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OIDC authentication failed: {str(e)}"
        )