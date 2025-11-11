from fastapi import APIRouter, Depends
from typing import Annotated
from core import models
from services import auth, capacity


router = APIRouter(prefix="/api")


@router.get("/stats/capacity")
async def get_cluster_capacity(
    current_user: Annotated[models.User, Depends(auth.check_role([]))]
):
    return capacity.get_cluster_capacity(current_user)


