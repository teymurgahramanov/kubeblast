from fastapi import APIRouter, Depends
from typing import Annotated
from core import models
from services import auth
from services.influxdb import get_live_metrics
from config import config

router = APIRouter(prefix="/api/v1")


@router.get("/metrics/{job_id}")
async def get_job_metrics(
    job_id: str,
    current_user: Annotated[models.User, Depends(auth.check_role([]))],
):
    if not config.INFLUXDB_ENABLED:
        return {"job_id": job_id, "enabled": False, "data": {}}

    result = get_live_metrics(job_id)
    result["job_id"] = job_id
    return result
