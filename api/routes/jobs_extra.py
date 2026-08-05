from typing import Annotated

from core import models
from fastapi import APIRouter, Depends, Query
from services import (
    auth,
    jobs_extra,  # type: ignore[attr-defined]  # Provided by the licensed overlay.
)

router = APIRouter(prefix="/api/v1")

@router.put("/jobs/{job_id}/approve", response_model=models.Job)
async def approve_job(
    current_user: Annotated[models.User, Depends(auth.check_role(["moderator", "admin"]))],
    job_id: str,
    approved: Annotated[bool, Query(...)]
    ):
    return jobs_extra.approve_job(current_user, job_id, approved)