from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Form, Response, Query
from fastapi.responses import FileResponse
from typing import Annotated, Literal, Optional
from api.core import models, config, db
from api.services import auth, jobs
import os, hashlib
from datetime import datetime

router = APIRouter()

@router.get("/jobs", response_model=models.Job)
async def get_job(
    current_user: Annotated[models.User, Depends(auth.check_role([]))],
    status: Optional[str] = Query(None),
    owner: Optional[str] = Query(None),
    name: Optional[str] = Query(None),
    ):
    return jobs.get_jobs(status=status, owner=owner, name=name)

@router.get("/jobs/{job_id}", response_model=models.Job)
async def get_job(job_id: str, current_user: Annotated[models.User, Depends(auth.check_role([]))]):
    return jobs.get_job(job_id)

@router.post("/jobs", response_model=models.Job)
async def create_job(
    current_user: Annotated[models.User, Depends(auth.check_role(["user", "admin"]))],
    description: Annotated[Optional[str], Form(max_length=60)] = None,
    file: UploadFile = File(...)
    ):

    if file.content_type != "text/plain":
        raise HTTPException(status_code=400, detail="Invalid file type. Expected text/plain")

    file_content = await file.read()

    return jobs.create_job(file_content, description, current_user.username)

@router.put("/jobs/{job_id}", response_model=models.Job)
async def approve_job(
    current_user: Annotated[models.User, Depends(auth.check_role(["moderator", "admin"]))],
    job_id: str, approved: bool = Form(...)
    ):
    return jobs.approve_job(job_id, approved)

@router.delete("/jobs/{job_id}")
async def delete_job(job_id: str, current_user: Annotated[models.User, Depends(auth.check_role([]))]):
    return jobs.delete_job(job_id, current_user)
