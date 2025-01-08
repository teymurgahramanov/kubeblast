import os
import yaml
from jinja2 import Template
from fastapi import APIRouter, UploadFile, File
from app.dependencies import kubernetes_client_batch, kubernetes_client_core

router = APIRouter()
namespace = "default"

@router.get("/jobs")
async def get_jobs():
    jobs = kubernetes_client_batch.list_namespaced_job(namespace=namespace)
    return {"jobs": [job.metadata.name for job in jobs.items]}

@router.get("/jobs/{job}")
async def get_job(job: str):
    return {"job": job}

@router.post("/jobs")
async def create_job(config_file: UploadFile = File(...)):
    # Generate ConfigMap
    file_content = await config_file.read()
    file_name = "plan.jmx"
    configmap_template_path = os.path.join(os.path.dirname(__file__), "../templates/configmap.yaml.j2")
    with open(configmap_template_path, 'r') as file:
        configmap_template_content = file.read()
    rendered_configmap = Template(configmap_template_content).render(
        configmap_name=f"{job_name}-configmap",
        namespace=namespace,
        data={file_name: file_content.decode("utf-8")}
    )
    configmap_manifest = yaml.safe_load(rendered_configmap)
    kubernetes_client_core.create_namespaced_config_map(
        namespace=namespace,
        body=configmap_manifest
    )

    # Generate Job
    job_template_path = os.path.join(os.path.dirname(__file__), "../templates/job.yaml.j2")
    with open(job_template_path, 'r') as file:
        job_template_content = file.read()
    rendered_job = Template(job_template_content).render(
        job_name=job_name,
        namespace=namespace,
        configmap_name=f"{job_name}-configmap"
    )
    job_manifest = yaml.safe_load(rendered_job)
    job = kubernetes_client_batch.create_namespaced_job(
        namespace=namespace,
        body=job_manifest
    )
    return {"job": {job.metadata.name}}

@router.delete("/jobs/{job}")
async def get_job(job: str):
    job = kubernetes_client_batch.delete_namespaced_job(
        namespace=namespace,
        name  = job
    )
    return {"job": "deleted"}