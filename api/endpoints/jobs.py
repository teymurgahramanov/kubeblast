from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Form
from fastapi.responses import FileResponse
from typing import Annotated, Literal, Optional
from api.core import models, auth, config, db
from api.services import jobs
import os, hashlib
from datetime import datetime

router = APIRouter()

@router.get("/jobs")
async def get_jobs(current_user: Annotated[models.User, Depends(auth.check_roles(["user", "admin", "moderator"]))]):
    return jobs.get_jobs(current_user)

@router.get("/jobs/{job_id}")
async def get_job(job_id: str, current_user: Annotated[models.User, Depends(auth.check_roles(["user", "admin", "moderator"]))]):
    return jobs.get_job(job_id)

@router.post("/jobs")
async def create_job(
    current_user: Annotated[models.User, Depends(auth.check_roles(["user", "admin"]))],
    description: Annotated[Optional[str], Form(max_length=60)],
    file: UploadFile = File(...)):

    if file.content_type != "text/plain":
        raise HTTPException(status_code=400, detail="Invalid file type. Expected text/plain")

    file_content = await file.read()
    job_name = f"{current_user.username}-{hashlib.sha256(file_content).hexdigest()[:6]}"

    job = db.mongo.jobs.find_one({"name": job_name})
    if job:
        return HTTPException(status_code=400, detail=F"Job with the same plan file already exists: {job_name}")

    file_name = f"{job_name}.jmx"
    file_path = os.path.join(config.config.UPLOAD_DIR, file_name)
    with open(file_path, "wb") as f:
        f.write(file_content)

    job_data = {
        "name": job_name,
        "user": current_user.username,
        "description": description,
        "status": "pending",
        "file_name": file_name,
        "created_at": datetime.now()
    }

    db.mongo.jobs.insert_one(job_data)

    return jobs.create_job(job_data)

@router.put("/jobs/{job_id}")
async def approve_job(current_user: Annotated[models.User, Depends(auth.check_roles(["moderator", "admin"]))],job_id: str, job_status: Literal["approved", "declined"] = Form(...)):
    return jobs.approve_job(job_id, job_status)

@router.delete("/jobs/{job_id}")
async def delete_job(job_id: str, current_user: Annotated[models.User, Depends(auth.check_roles(["user", "admin"]))]):
    return jobs.delete_job(job_id, current_user)

@router.get("/jobs/files/{file_name}")
async def download_file(file_name: str):
    file_path = os.path.join(config.config.UPLOAD_DIR, file_name)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(file_path, media_type="text/plain", filename=file_name)
