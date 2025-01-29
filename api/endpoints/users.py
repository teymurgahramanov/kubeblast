from typing import Annotated
from fastapi import Depends, APIRouter
from api.core import auth, models
from api.services import users
from fastapi import Request

router = APIRouter()

@router.get("/users")
async def get_users(current_user: Annotated[models.User, Depends(auth.check_roles(["admin"]))]):
  return users.get_users()

@router.get("/users/{username}")
async def get_user(username: str, current_user: Annotated[models.User, Depends(auth.check_roles(["admin"]))]):
  return users.get_user(username)

@router.post("/users")
async def create_user(user_data: Annotated[models.UserCreate, Depends(models.UserCreate.create_form)], current_user: Annotated[models.User, Depends(auth.check_roles(["admin"]))]):
  return users.create_user(user_data)

@router.put("/users/{username}")
async def update_user(user_data: Annotated[models.UserCreate, Depends(models.UserUpdate.update_form)], username: str, current_user: Annotated[models.User, Depends(auth.check_roles(["admin"]))]):
  return users.update_user(username, user_data=dict(user_data))

@router.delete("/users/{username}")
async def delete_user(username: str, current_user: Annotated[models.User, Depends(auth.check_roles(["admin"]))]):
  return users.delete_user(username)