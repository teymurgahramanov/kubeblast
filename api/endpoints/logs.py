from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from api.services.logs import stream_pod_logs

router = APIRouter()

@router.get("/logs/{job}")
async def get_log(job: str):
    return StreamingResponse(stream_pod_logs(job), media_type="text/event-stream")