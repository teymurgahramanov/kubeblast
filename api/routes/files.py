from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from typing import Annotated, Literal
from core import models
from services import auth
from config import config

from services import files_fs as files

router = APIRouter(prefix="/api")

@router.get("/files/{job_id}")
async def get_file(
    current_user: Annotated[models.User, Depends(auth.check_role([]))], 
    job_id: str, 
    type: Annotated[Literal["plan", "result"], Query(...)]
):
    return files.download_file(current_user, job_id, type)