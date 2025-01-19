from typing import Annotated
from fastapi import Depends, APIRouter
from api.core import models
from api.core import security

router = APIRouter()

@router.get("/users/me")
async def read_users_me(current_user: Annotated[models.User, Depends(security.check_roles(["user","admin"]))]):
  return current_user.username + current_user.role

@router.get("/users/all")
async def read_users_all(current_user: Annotated[models.User, Depends(security.check_roles(["admin"]))]):
  return current_user.username + current_user.role

@router.get("/users/moderator")
async def read_users_all(current_user: Annotated[models.User, Depends(security.check_roles(["moderator","admin"]))]):
  return current_user.username + current_user.role