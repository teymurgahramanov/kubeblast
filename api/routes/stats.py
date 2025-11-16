from fastapi import APIRouter, Depends
from typing import Annotated
from core import models, db
from services import auth, capacity
from config import config


router = APIRouter(prefix="/api")


@router.get("/stats/capacity")
async def get_cluster_capacity(
    current_user: Annotated[models.User, Depends(auth.check_role([]))]
):
    data = capacity.get_capacity()

    user_jobs_total = db.mongo.jobs.count_documents({"owner": current_user.username}) if current_user.username else 0

    data["jobsTotal"] = db.mongo.jobs.count_documents({"status": "running"})
    data["userJobsTotal"] = user_jobs_total
    data["perUserCurrentJobsLimit"] = config.PER_USER_CURRENT_JOBS_LIMIT
    data["jobResources"] = config.K8S_JOB_RESOURCES or {}

    return data


@router.get("/stats/app")
async def get_app_stats():
    return {
        "APP_VERSION": config.APP_VERSION,
        "LICENSE_VALID": config.LICENSE_VALID,
    }