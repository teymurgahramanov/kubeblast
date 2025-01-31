from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Form
from fastapi.responses import FileResponse
from typing import Annotated, Literal
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
async def create_job(current_user: Annotated[models.User, Depends(auth.check_roles(["user"]))], description: Annotated[str, Form()], file: UploadFile = File(...)):

    if file.content_type != "text/plain":
        raise HTTPException(status_code=400, detail="Invalid file type. Expected text/plain")

    job_name = f"{current_user.username}-{hashlib.sha256(file_content).hexdigest()[:6]}"
    file_content = await file.read()
    file_name = f"{job_name}.jmx"
    file_path = os.path.join(config.config.UPLOAD_DIR, file_name)

    with open(file_path, "wb") as f:
        f.write(file_content)

    return jobs.create_job(job_name, description, current_user)

@router.put("/jobs/{job_id}")
async def update_job(current_user: Annotated[models.User, Depends(auth.check_roles(["moderator", "admin"]))],job_id: str, job_status: Literal["approved", "declined"] = Form(...)):
    return jobs.update_job(job_id, job_status)

@router.delete("/jobs/{job_id}")
async def delete_job(job_id: str, current_user: Annotated[models.User, Depends(auth.check_roles(["user", "admin"]))]):
    return jobs.delete_job(job_id, current_user)

@router.get("/jobs/files/{file_name}")
async def download_file(file_name: str):
    file_path = os.path.join(config.config.UPLOAD_DIR, file_name)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(file_path, media_type="text/plain", filename=file_name)
