from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from core import models
from services import auth, jobs, logs

router = APIRouter(prefix="/api/v1")


@router.get(
    "/jobs/{job_id}/logs",
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
    - Pod log lines are **stored in MongoDB** and **streamed** using Server-Sent Events (SSE), same pattern as `/jobs/{job_id}/events`.
    - Each `data:` line is a JSON object: `{"job_id", "ts", "msg"}` where `msg` is one log line.
    - You **must pass a Bearer token** in the `Authorization` header.
    - The response **MUST be read as a stream**; it stays open while the job exists.

    ### Example `curl` Request:
    ```
    curl -N -H "Authorization: Bearer <your_token>" http://localhost:8000/api/v1/jobs/<job_id>/logs
    ```
    """,
)
async def get_logs(
    current_user: Annotated[models.User, Depends(auth.check_role([]))],
    job_id: str,
):
    jobs.get_job(current_user, job_id)
    return StreamingResponse(
        logs.stream_job_logs(job_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
