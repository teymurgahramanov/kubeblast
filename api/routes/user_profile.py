from typing import Annotated, List
from fastapi import Depends, APIRouter
from core import models
from services import auth, user_profile

router = APIRouter(prefix="/api/v1")

@router.get("/profile", response_model=models.User)
async def get_user(current_user: Annotated[models.User, Depends(auth.check_role([]))]):
  return user_profile.get_profile(current_user.username)

@router.put("/profile", response_model=models.User)
async def update_user_me(user_data: Annotated[models.UserUpdate, Depends(models.UserUpdate.update_self_form)],
                         current_user: Annotated[models.User, Depends(auth.get_current_active_user)]
                         ) -> models.User:
  return user_profile.update_profile(current_user.username, user_data=dict(user_data))

@router.post("/profile/pats", response_model=models.PatCreatedResponse)
async def create_pat(
    pat_data: models.PatCreate,
    current_user: Annotated[models.User, Depends(auth.get_current_active_user)]
):
    return user_profile.create_pat(current_user.username, pat_data)

@router.get("/profile/pats", response_model=List[models.Pat])
async def list_pats(
    current_user: Annotated[models.User, Depends(auth.get_current_active_user)]
):
    return user_profile.list_pats(current_user.username)

@router.post("/profile/pats/{pat_id}/revoke", response_model=models.Pat)
async def revoke_pat(
    pat_id: str,
    current_user: Annotated[models.User, Depends(auth.get_current_active_user)]
):
    return user_profile.revoke_pat(current_user.username, pat_id)

@router.delete("/profile/pats/{pat_id}", response_model=None)
async def delete_pat(
    pat_id: str,
    current_user: Annotated[models.User, Depends(auth.get_current_active_user)]
):
    return user_profile.delete_pat(current_user.username, pat_id)