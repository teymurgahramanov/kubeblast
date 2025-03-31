from fastapi import APIRouter, Depends, Query
from typing import Annotated
from core import models
from services import auth, jobs_extra

router = APIRouter(prefix="/api")

@router.put("/jobs/approve/{job_id}", response_model=models.Job)
async def approve_job(
    current_user: Annotated[models.User, Depends(auth.check_role(["moderator", "admin"]))],
    job_id: str,
    approved: Annotated[bool, Query(...)]
    ):
    return jobs_extra.approve_job(current_user, job_id, approved)

@router.put("/jobs/retry/{job_id}", response_model=models.Job)
async def retry_job(
    current_user: Annotated[models.User, Depends(auth.check_role(["user", "admin"]))],
    job_id: str
    ):
    return jobs_extra.retry_job(current_user, job_id)