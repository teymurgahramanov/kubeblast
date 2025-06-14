from typing import Annotated, List
from fastapi import Depends, APIRouter
from core import models
from services import auth, users
from fastapi import Request

router = APIRouter(prefix="/api")

@router.get("/users", response_model=List[models.User])
async def get_users(current_user: Annotated[models.User, Depends(auth.check_role(["admin"]))]):
  return users.get_users()

@router.get("/users/{username}", response_model=models.User)
async def get_user(username: str, current_user: Annotated[models.User, Depends(auth.check_role([]))]):
  return users.get_user(username)

@router.post("/users", response_model=models.User)
async def create_user(user_data: Annotated[models.UserCreate, Depends(models.UserCreate.create_form)], current_user: Annotated[models.User, Depends(auth.check_role(["admin"]))]):
  return users.create_user(user_data)

@router.put("/users/{username}", response_model=models.User)
async def update_user(user_data: Annotated[models.UserUpdate, Depends(models.UserUpdate.update_admin_form)], username: str, current_user: Annotated[models.User, Depends(auth.check_role(["admin"]))]):
  return users.update_user(username, user_data=dict(user_data))

@router.delete("/users/{username}")
async def delete_user(username: str, current_user: Annotated[models.User, Depends(auth.check_role(["admin"]))]):
  return users.delete_user(username)