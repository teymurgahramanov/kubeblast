from fastapi import APIRouter, Depends
from typing import Annotated
from fastapi.responses import StreamingResponse
from api.core import models
from api.services import auth
from api.services.logs import stream_pod_logs

router = APIRouter()

@router.get("/logs/{job}")
async def get_log(job: str, current_user: Annotated[models.User, Depends(auth.check_role(["user", "admin"]))]):
    return StreamingResponse(stream_pod_logs(job), media_type="text/event-stream")