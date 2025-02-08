from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from typing import Annotated, Literal
import os
from api.core import models, config
from api.services import jobs, auth

router = APIRouter()

@router.get("/files/{job_id}")
async def get_file(
    current_user: Annotated[models.User, Depends(auth.check_role([]))], 
    job_id: str, 
    type: Annotated[Literal["plan", "report"], Query(...)],
    download: Annotated[bool, Query(...)]
):
    job = jobs.get_job(current_user, job_id).dict()

    match type:
        case "plan":
            file_name = f"{job['name']}.jmx"
            file_path = os.path.join(config.config.PLAN_DIR, file_name)
            media_type = "application/xml"
        case "report":
            file_name = f"{job['name']}.pdf"
            file_path = os.path.join(config.config.REPORT_DIR, file_name)
            media_type = "application/pdf"

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    content_disposition = f'{"attachment" if download else "inline"}; filename="{file_name}"'

    return FileResponse(
        file_path,
        media_type=media_type,
        filename=file_name,
        headers={"Content-Disposition": content_disposition}
    )
