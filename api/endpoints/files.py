from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Form, Response, Query
from fastapi.responses import FileResponse
from typing import Annotated, Literal, Optional
from api.core import models, config, db
from api.services import auth, jobs
import os, hashlib
from datetime import datetime

router = APIRouter()

@router.get("/files/{job_id}")
async def download_file(current_user: Annotated[models.User, Depends(auth.check_role([]))], job_id: str, type: Annotated[Literal["plan", "report"], Query(...)]):
    job = jobs.get_job(current_user,job_id).dict()

    if type == "plan":
        file_path = os.path.join(config.config.PLAN_DIR, f"{job['name']}.jmx")
    elif type == "report":
        file_path = os.path.join(config.config.REPORT_DIR, f"{job['name']}.pdf")

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(file_path, media_type="text/plain", filename=file_path)