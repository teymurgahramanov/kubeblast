from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from typing import Annotated
from api.core import models, auth, config
from api.services import jobs
import os, hashlib

router = APIRouter()

@router.get("/jobs")
async def get_jobs(current_user: Annotated[models.User, Depends(auth.check_roles(["user", "admin", "moderator"]))]):
    return jobs.get_jobs(current_user)

@router.get("/jobs/{job_id}")
async def get_job(job_id: str, current_user: Annotated[models.User, Depends(auth.check_roles(["user", "admin", "moderator"]))]):
    return jobs.get_job(job_id)

@router.post("/jobs")
async def create_job(job_data: Annotated[models.JobCreate, Depends(models.JobCreate.create_form)], current_user: Annotated[models.User, Depends(auth.check_roles(["user"]))], file: UploadFile = File(...)):

    if file.content_type != "text/plain":
        raise HTTPException(status_code=400, detail="Invalid file type. Expected text/plain")

    file_content = await file.read()
    file_name = f"{current_user.username}_{job_data.name}_{hashlib.sha256(file_content).hexdigest()}.jmx"
    file_path = os.path.join(config.config.UPLOAD_DIR, file_name)

    with open(file_path, "wb") as f:
        f.write(file_content)

    return jobs.create_job(job_data, file_name, current_user)

@router.put("/jobs/{job_id}")
async def update_job(job_id: str, job_data: Annotated[models.JobUpdate, Depends(models.JobUpdate.update_form)], current_user: Annotated[models.User, Depends(auth.check_roles(["moderator", "admin"]))]):
    return jobs.update_job(job_id, job_data=dict(job_data))

@router.delete("/jobs/{job_id}")
async def delete_job(job_id: str, current_user: Annotated[models.User, Depends(auth.check_roles(["user", "admin"]))]):
    return jobs.delete_job(job_id, current_user)

@router.get("/jobs/files/{file_name}")
async def download_file(file_name: str):
    file_path = os.path.join(config.config.UPLOAD_DIR, file_name)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(file_path, media_type="text/plain", filename=file_name)
