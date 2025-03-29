from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Form, Response, Query
from fastapi.responses import FileResponse
from typing import Annotated, Literal, Optional, List
from api.core import models, db
from api.services import auth, jobs
from datetime import datetime

router = APIRouter(prefix="/api")

@router.get("/jobs", response_model=List[models.Job])
async def get_job(
    current_user: Annotated[models.User, Depends(auth.check_role([]))],
    status: Optional[str] = Query(None),
    owner: Optional[str] = Query(None),
    name: Optional[str] = Query(None),
    ):
    return jobs.get_jobs(current_user, status=status, owner=owner, name=name)

@router.get("/jobs/{job_id}", response_model=models.Job)
async def get_job(job_id: str, current_user: Annotated[models.User, Depends(auth.check_role([]))]):
    return jobs.get_job(current_user, job_id)

@router.post("/jobs", response_model=models.Job)
async def create_job(
    current_user: Annotated[models.User, Depends(auth.check_role(["user", "admin"]))],
    description: Annotated[Optional[str], Form(max_length=60)] = None,
    file: UploadFile = File(...),
    distributed: Annotated[Optional[bool], Form()] = False,
    ):

    if file.content_type not in ["text/plain", "application/xml", "application/octet-stream"]:
        raise HTTPException(status_code=400, detail=f"Invalid file type. Received: {file.content_type}")

    file_content = await file.read()

    return jobs.create_job(current_user, file_content, description, distributed)

@router.put("/jobs/approve/{job_id}", response_model=models.Job)
async def approve_job(
    current_user: Annotated[models.User, Depends(auth.check_role(["moderator", "admin"]))],
    job_id: str,
    approved: Annotated[bool, Query(...)]
    ):
    return jobs.approve_job(current_user, job_id, approved)

@router.put("/jobs/retry/{job_id}", response_model=models.Job)
async def retry_job(
    current_user: Annotated[models.User, Depends(auth.check_role(["user", "admin"]))],
    job_id: str
    ):
    return jobs.retry_job(current_user, job_id)

@router.delete("/jobs/{job_id}")
async def delete_job(job_id: str, current_user: Annotated[models.User, Depends(auth.check_role(["user", "admin"]))]):
    return jobs.delete_job(current_user, job_id)