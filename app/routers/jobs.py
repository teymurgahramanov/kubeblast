import yaml
from fastapi import APIRouter
from app.dependencies import kubernetes_client_batch as kubernetes_client

router = APIRouter()
namespace = "default"

@router.get("/jobs")
async def get_jobs():
    jobs = kubernetes_client.list_namespaced_job(namespace=namespace)
    return {"jobs": [job.metadata.name for job in jobs.items]}

@router.get("/jobs/{job}")
async def get_job(job: str):
    return {"job": job}

@router.post("/jobs")
async def create_job():
    with open("/app/app/job.yaml", 'r') as file:
        job_manifest = yaml.safe_load(file)
    job = kubernetes_client.create_namespaced_job(
        namespace=namespace,
        body=job_manifest
    )
    return {"job": {job.metadata.name}}

@router.delete("/jobs/{job}")
async def get_job(job: str):
    job = kubernetes_client.delete_namespaced_job(
        namespace=namespace,
        name  = job
    )
    return {"job": "deleted"}