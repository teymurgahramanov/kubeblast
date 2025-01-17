from typing import Annotated
from fastapi import Depends, APIRouter
from api.dependencies import secuirty, users

router = APIRouter()

@router.get("/users/me")
async def read_users_me():
  return secuirty.current_user