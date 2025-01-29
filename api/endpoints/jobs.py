from fastapi import APIRouter, Depends, UploadFile, File
from typing import Annotated
from api.core import models, auth
from api.services import jobs


router = APIRouter()

@router.get("/jobs")
async def get_jobs(current_user: Annotated[models.User, Depends(auth.check_roles(["user, admin, moderator"]))]):
    return jobs.get_jobs(current_user)

@router.get("/jobs/{job}")
async def get_job(job: str, current_user: Annotated[models.User, Depends(auth.check_roles(["user, admin, moderator"]))]):
    return job

@router.post("/jobs")
async def create_job(job_data: Annotated[models.UserCreate, Depends(models.JobCreate.create_form)], current_user: Annotated[models.User, Depends(auth.check_roles(["user"]))], file: UploadFile = File(...)):
    return jobs.create_job(job_data, file, current_user)

@router.put("/jobs/{job}")
async def update_job(job_data: Annotated[models.UserCreate, Depends(models.JobUpdate.update_form)], job: str, current_user: Annotated[models.User, Depends(auth.check_roles(["user", "moderator"]))]):
    return jobs.update_job(job, job_data)

@router.delete("/jobs/{job}")
async def delete_job(job: str, current_user: Annotated[models.User, Depends(auth.check_roles(["user", "admin"]))]):
    return job