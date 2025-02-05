from typing import Annotated, Optional
from fastapi import Depends, APIRouter, Query
from api.core import models
from api.services import auth, users, jobs

router = APIRouter()

@router.get("/profile")
async def read_users_me(current_user: Annotated[models.User, Depends(auth.get_current_active_user)],
                        status: Optional[str] = Query(None, description="Filter jobs by status")
    ):
  user_data = users.get_user(current_user.username)
  user_jobs = jobs.get_jobs(status=status)
  return [user_data, user_jobs]

@router.put("/profile", response_model=models.User)
async def update_user(user_data: Annotated[models.UserUpdate, Depends(models.UserUpdate.update_self_form)], current_user: Annotated[models.User, Depends(auth.get_current_active_user)]):
  return users.update_user(current_user, user_data=dict(user_data))