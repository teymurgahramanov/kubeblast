from fastapi import APIRouter, Depends
from typing import Annotated
from fastapi.responses import StreamingResponse

from core import models
from services import auth, jobs, events


router = APIRouter(prefix="/api/v1")


@router.get(
    "/jobs/{job_id}/events",
    response_class=StreamingResponse,
    responses={
        200: {
            "description": "Stream job events (Server-Sent Events).",
            "content": {"text/event-stream": {}},
        },
        401: {"description": "Unauthorized"},
        404: {"description": "Job not found"},
    },
    summary="Stream job events",
    description="""
    ### How to Use
    - This endpoint **streams job events** using Server-Sent Events (SSE).
    - The response follows SSE format, with each message prefixed with `data:`.
    - You **must pass a Bearer token** in the `Authorization` header.
    - The response **MUST be read as a stream**, it will not complete like a normal HTTP request.

    ### Example `curl` Request:
    ```
    curl -N -H "Authorization: Bearer <your_token>" http://localhost:8000/api/v1/jobs/<job_id>/events
    ```
    """,
)
async def get_events(
    current_user: Annotated[models.User, Depends(auth.check_role([]))],
    job_id: str,
):
    # AuthZ check (and 404/403) mirrors logs route behavior.
    jobs.get_job(current_user, job_id)
    return StreamingResponse(events.stream_job_events(job_id), media_type="text/event-stream")


