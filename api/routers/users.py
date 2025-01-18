from typing import Annotated
from fastapi import Depends, APIRouter
from api.dependencies import secuirty, users

router = APIRouter()

@router.get("/users/me")
async def read_users_me():
  return secuirty.current_user

@router.get("/users/all")
async def read_users_all():
  return secuirty.current_user