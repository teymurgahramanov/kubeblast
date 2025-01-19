from typing import Annotated
from fastapi import Depends, APIRouter
from api.dependencies import auth

router = APIRouter()

@router.get("/users/me")
async def read_users_me(current_user: Annotated[auth.User, Depends(auth.check_roles(["user","admin"]))]):
  return current_user.username + current_user.role

@router.get("/users/all")
async def read_users_all(current_user: Annotated[auth.User, Depends(auth.check_roles(["admin"]))]):
  return current_user.username + current_user.role

@router.get("/users/moderator")
async def read_users_all(current_user: Annotated[auth.User, Depends(auth.check_roles(["moderator","admin"]))]):
  return current_user.username + current_user.role