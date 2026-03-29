from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from core import models
from services import auth, jobs, logs

router = APIRouter(prefix="/api/v1")


@router.get(
    "/logs/{job_id}",
    response_class=StreamingResponse,
    responses={
        200: {
            "description": "Stream Kubernetes pod logs (Server-Sent Events).",
            "content": {"text/event-stream": {}},
        },
        401: {"description": "Unauthorized"},
        404: {"description": "Job or pod not found"},
    },
    summary="Stream Kubernetes pod logs",
    description="""
    ### How to Use
    - Pod log lines are **stored in MongoDB** and **streamed** using Server-Sent Events (SSE), same pattern as `/events/{job_id}`.
    - Each `data:` line is a JSON object: `{"job_id", "ts", "msg"}` where `msg` is one log line.
    - You **must pass a Bearer token** in the `Authorization` header.
    - The response **MUST be read as a stream**; it stays open while the job exists.

    ### Example `curl` Request:
    ```
    curl -N -H "Authorization: Bearer <your_token>" http://localhost:8000/api/v1/logs/<job_id>
    ```
    """,
)
async def get_logs(
    current_user: Annotated[models.User, Depends(auth.check_role([]))],
    job_id: str,
):
    job = jobs.get_job(current_user, job_id)
    logs.ensure_log_pump(job_id, job.status)
    return StreamingResponse(logs.stream_job_logs(job_id), media_type="text/event-stream")
