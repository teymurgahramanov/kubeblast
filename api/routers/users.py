from typing import Annotated
from fastapi import Depends, APIRouter
from api.dependencies import auth

router = APIRouter()

@router.get("/users/me")
async def read_users_me(current_user: Annotated[auth.User, Depends(auth.get_current_active_user)]):
  return "me: " + current_user.username

@router.get("/users/all")
async def read_users_all(current_user: Annotated[auth.User, Depends(auth.get_current_active_superuser)]):
  return "admin: " + current_user.username