from typing import Annotated, List
from fastapi import Depends, APIRouter
from core import models
from services import auth, pats

router = APIRouter(prefix="/api/v1")

@router.post("/pats", response_model=models.PatCreatedResponse)
async def create_pat(
    pat_data: models.PatCreate,
    current_user: Annotated[models.User, Depends(auth.get_current_active_user)]
):
    return pats.create_pat(current_user.username, pat_data)

@router.get("/pats", response_model=List[models.Pat])
async def list_pats(
    current_user: Annotated[models.User, Depends(auth.get_current_active_user)]
):
    return pats.list_pats(current_user.username)

@router.post("/pats/{pat_id}/revoke", response_model=models.Pat)
async def revoke_pat(
    pat_id: str,
    current_user: Annotated[models.User, Depends(auth.get_current_active_user)]
):
    return pats.revoke_pat(current_user.username, pat_id)

@router.delete("/pats/{pat_id}", response_model=None)
async def delete_pat(
    pat_id: str,
    current_user: Annotated[models.User, Depends(auth.get_current_active_user)]
):
    return pats.delete_pat(current_user.username, pat_id)