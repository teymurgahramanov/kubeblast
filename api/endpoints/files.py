from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Form, Response, Query
from fastapi.responses import FileResponse
from typing import Annotated, Literal, Optional
from api.core import models, config, db
from api.services import auth, jobs
import os, hashlib
from datetime import datetime

router = APIRouter()

@router.get("/files/plans/{file_name}")
async def download_file(file_name: str, current_user: Annotated[models.User, Depends(auth.check_role([]))]):
    file_path = os.path.join(config.config.UPLOAD_DIR, file_name)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(file_path, media_type="text/plain", filename=file_name)