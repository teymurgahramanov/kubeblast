from services import auth
from fastapi import APIRouter, Depends, Query, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from typing import Annotated, Literal
from datetime import timedelta
from core import models
from core.log import logger
from config import config

router = APIRouter(prefix="/api/v1")

@router.post("/token", response_model=models.Token)
async def login(
  form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
  method: Annotated[Literal["ldap", "local"], Query(...)] = "local"
  ):
  return auth.login(form_data,method)


@router.post("/token/refresh", response_model=models.Token)
async def refresh_token(request: models.RefreshTokenRequest):
    try:
        username = auth.verify_refresh_token(request.refresh_token)
        
        user = auth.get_user(username)
        if not user or not user.enabled:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or inactive"
            )
        
        access_token = auth.create_access_token(
            data={"sub": user.username, "role": user.role},
            expires_delta=timedelta(minutes=config.ACCESS_TOKEN_EXPIRE_MINUTES)
        )
        
        return models.Token(
            access_token=access_token,
            token_type="bearer",
            refresh_token=request.refresh_token
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