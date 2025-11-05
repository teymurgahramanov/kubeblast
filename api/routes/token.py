from services import auth
from fastapi import APIRouter, Depends, Query, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from typing import Annotated, Literal, Optional
from datetime import timedelta
from core import models
from core.log import logger
from config import config
import secrets

router = APIRouter(prefix="/api")

_oauth_states = {}

@router.post("/token", response_model=models.Token)
async def login(
  form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
  method: Annotated[Literal["ldap", "local"], Query(...)] = "local"
  ):
  return auth.login(form_data,method)


@router.post("/token/refresh", response_model=models.Token)
async def refresh_token(refresh_token: str):
    try:
        username = auth.verify_refresh_token(refresh_token)
        
        user = auth.get_user(username)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found"
            )
        
        access_token = auth.create_access_token(
            data={"sub": user.username, "role": user.role},
            expires_delta=timedelta(minutes=config.ACCESS_TOKEN_EXPIRE_MINUTES)
        )
        
        return models.Token(
            access_token=access_token,
            token_type="bearer",
            refresh_token=refresh_token
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Token refresh error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Failed to refresh token"
        )


@router.post("/logout")
async def logout(current_user: Annotated[models.User, Depends(auth.get_current_active_user)]):
    """Logout user and revoke refresh token."""
    try:
        auth.revoke_refresh_token(current_user.username)
        return {"message": "Logged out successfully"}
    except Exception as e:
        logger.error(f"Logout error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to logout"
        )


@router.get("/oauth/enabled")
async def oauth_enabled():
    """Check if OAuth is enabled."""
    return {
        "enabled": config.OAUTH_ENABLED
    }


@router.get("/oauth/authorize")
async def oauth_authorize():
    """Get OAuth authorization URL to redirect user to provider."""
    if not config.OAUTH_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OAuth authentication is not enabled"
        )
    
    try:
        from services.oauth_auth import OAuthAuth
        oauth = OAuthAuth()
        
        state = secrets.token_urlsafe(32)
        _oauth_states[state] = True
        
        auth_url = oauth.get_authorization_url(state)
        
        return {
            "authorization_url": auth_url,
            "state": state
        }
    except Exception as e:
        logger.error(f"Failed to generate OAuth URL: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OAuth not properly configured: {str(e)}"
        )


@router.get("/oauth/callback")
async def oauth_callback(
    code: str = Query(...),
    state: str = Query(...),
    error: Optional[str] = Query(None)
):
    """Handle OAuth callback - exchange code for token."""
    if not config.OAUTH_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OAuth authentication is not enabled"
        )
    
    if error:
        logger.error(f"OAuth provider error: {error}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"OAuth authentication failed: {error}"
        )
    
    if state not in _oauth_states:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid state parameter"
        )
    _oauth_states.pop(state, None)
    
    try:
        from services.oauth_auth import OAuthAuth
        oauth = OAuthAuth()
        
        oauth_user = await oauth.authenticate(code)
        
        if not oauth_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="OAuth authentication failed"
            )
        
        user_data = oauth.map_oauth_user_to_db_user(oauth_user)
        
        token = auth.login(method="oauth", oauth_user_data=user_data.dict())
        
        return {
            "access_token": token.access_token,
            "token_type": token.token_type,
            "refresh_token": token.refresh_token,
            "username": user_data.username,
            "role": user_data.role
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"OAuth callback error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OAuth authentication failed: {str(e)}"
        )