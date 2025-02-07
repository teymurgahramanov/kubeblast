from fastapi import APIRouter, Depends
from typing import Annotated
from fastapi.responses import StreamingResponse
from api.core import models
from api.services import auth
from api.services.logs import stream_pod_logs

router = APIRouter()

@router.get("/logs/{job_id}")
async def get_logs(current_user: Annotated[models.User, Depends(auth.check_role([]))], job_id: str):
    return StreamingResponse(stream_pod_logs(job_id), media_type="text/event-stream")