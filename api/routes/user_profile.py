from typing import Annotated
from fastapi import Depends, APIRouter
from core import models
from services import auth, user_profile

router = APIRouter(prefix="/api")

@router.get("/profile", response_model=models.User)
async def get_user(current_user: Annotated[models.User, Depends(auth.check_role([]))]):
  return user_profile.get_profile(current_user.username)

@router.put("/profile", response_model=models.User)
async def update_user_me(user_data: Annotated[models.UserUpdate, Depends(models.UserUpdate.update_self_form)], current_user: Annotated[models.User, Depends(auth.get_current_active_user)]):
  return user_profile.update_profile(current_user.username, user_data=dict(user_data))