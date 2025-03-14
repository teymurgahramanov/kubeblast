from fastapi import APIRouter, Depends
from typing import Annotated
from fastapi.responses import StreamingResponse
from api.core import models
from api.services import auth, jobs, k8s
import asyncio

router = APIRouter(prefix="/api")

@router.get(
    "/logs/{job_id}",
    response_class=StreamingResponse,
    responses={
        200: {
            "description": "Stream live Kubernetes pod logs (Server-Sent Events).",
            "content": {"text/event-stream": {}},
        },
        401: {"description": "Unauthorized"},
        404: {"description": "Job or pod not found"},
    },
    summary="Stream Kubernetes pod logs",
    description="""
    ### 📌 How to Use
    - This endpoint **streams Kubernetes logs in real-time** using Server-Sent Events (SSE).
    - The response follows the SSE format, with **each log line prefixed with `data:`**.
    - You **must pass a Bearer token** in the `Authorization` header.
    - The response **MUST be read as a stream**, it **will not complete** like a normal HTTP request.

    ### 🔹 Example `curl` Request:
    ```
    curl -N -H "Authorization: Bearer <your_token>" http://localhost:8000/logs/<job_id>
    ```

    ### 🔹 Example Response:
    ```
    data: Log line 1...

    data: Log line 2...

    data: Log line 3...
    ```

    ### 🔹 JavaScript Client Example (Recommended for Browsers):
    ```html
    <script>
        const jobId = "67a74316b2960a28417e248d";  // Example Job ID
        const logOutput = document.getElementById("log-output");

        const eventSource = new EventSource(`http://localhost:8000/logs/${jobId}`);

        eventSource.onmessage = function(event) {
            logOutput.innerText += event.data + "\\n";
        };

        eventSource.onerror = function() {
            console.error("Log streaming connection lost.");
            eventSource.close();
        };
    </script>
    ```
    """,
)
async def get_logs(current_user: Annotated[models.User, Depends(auth.check_role([]))], job_id: str):
    """Stream Kubernetes pod logs using SSE."""
    jobs.get_job(current_user, job_id)
    return StreamingResponse(k8s.stream_pod_logs(job_id), media_type="text/event-stream")
