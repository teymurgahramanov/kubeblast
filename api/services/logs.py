from fastapi import APIRouter, Depends
from typing import Annotated
from fastapi.responses import StreamingResponse
from api.core import models
from api.services import auth, jobs
from kubernetes import client
from api.core.config import config
import asyncio

def stream_pod_logs(current_user, job_id):
    """Asynchronously stream logs from a Kubernetes pod."""
    namespace = config.K8S_NAMESPACE
    job = jobs.get_job(current_user, job_id).dict()
    job_name = job['name']
    
    try:
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