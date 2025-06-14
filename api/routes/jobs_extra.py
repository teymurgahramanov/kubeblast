from fastapi import APIRouter, Depends, Query, BackgroundTasks
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