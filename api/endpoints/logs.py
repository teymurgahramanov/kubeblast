from fastapi import APIRouter, Depends
from typing import Annotated
from fastapi.responses import StreamingResponse
from api.core import models
from api.services import auth, jobs
from kubernetes import client
from api.core.config import config
import asyncio

router = APIRouter()

def stream_pod_logs(current_user, job_id):
    """Asynchronously stream logs from a Kubernetes pod."""
    namespace = config.K8S_NAMESPACE
    job = jobs.get_job(current_user, job_id).dict()
    job_name = job['name']
    
    try:
        core_v1 = client.CoreV1Api()
        label_selector = f"job-name={job_name}"
        print(f"Searching for pods with label: {label_selector} in namespace: {namespace}")

        pod_list = client.CoreV1Api().list_namespaced_pod(
            namespace=namespace,
            label_selector=label_selector
        )

        if not pod_list.items:
            print(f"No Pods found for Job: {job_name}")
            yield "data: No pods found for this job.\n\n"
            return
        
        pod_name = pod_list.items[0].metadata.name
        print(f"Streaming logs from pod: {pod_name}")

        logs =client.CoreV1Api().read_namespaced_pod_log(
            name=pod_name,
            namespace=namespace,
            follow=True,
            _preload_content=False,
        )

        for line in logs.stream():
            yield f"data: {line.decode('utf-8')}\n\n"  # SSE format

    except client.exceptions.ApiException as e:
        yield f"data: Error: {e.reason}\n\n"
        return

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
    return StreamingResponse(stream_pod_logs(current_user, job_id), media_type="text/event-stream")
