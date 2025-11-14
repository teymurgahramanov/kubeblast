from fastapi import APIRouter, Depends
from typing import Annotated
from core import models
from services import auth, capacity
from config import config as app_config


router = APIRouter(prefix="/api")


@router.get("/stats/capacity")
async def get_cluster_capacity(
    current_user: Annotated[models.User, Depends(auth.check_role([]))]
):
    return capacity.get_cluster_capacity(current_user)


@router.get("/stats/app")
async def get_app_stats():
    return {
        "APP_VERSION": app_config.APP_VERSION,
        "LICENSE_VALID": app_config.LICENSE_VALID,
    }

