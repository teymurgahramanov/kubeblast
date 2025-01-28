from typing import Annotated
from fastapi import Depends, APIRouter
from api.core import models, security
from api.services import users

router = APIRouter()

@router.get("/profile")
async def read_users_me(current_user: Annotated[models.User, Depends(security.get_current_active_user)]):
  return users.get_user(current_user.username)