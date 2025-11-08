from fastapi import APIRouter, Depends
from typing import Annotated
from core import models
from services import auth
from services.resources import get_cluster_resources


router = APIRouter(prefix="/api")


@router.get("/resources")
async def resources(
    current_user: Annotated[models.User, Depends(auth.check_role([]))]
):
    return get_cluster_resources(current_user)


