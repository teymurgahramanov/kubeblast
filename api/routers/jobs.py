import os
import yaml
from jinja2 import Template
from fastapi import APIRouter, HTTPException, UploadFile, File, Header
from api import dependencies

router = APIRouter()
namespace = "default"

@router.get("/jobs")
async def get_jobs():
    return dependencies.list_workloads()

@router.get("/jobs/{job}")
async def get_job(job: str):
    return {"job": job}

@router.post("/jobs")
async def create_job(plan_file: UploadFile = File(...),project_name: str = Header(None)):

    if not project_name:
        raise HTTPException(status_code=400, detail="PROJECT_NAME header is required")
    job_name = project_name

    if plan_file.content_type != "text/plain":
        raise HTTPException(status_code=400, detail="Invalid file type. Expected text/plain")
    
    try:
        file_name = "plan.jmx"
        file_content = await plan_file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read uploaded file: {str(e)}")
    
    return dependencies.create_workload(job_name, file_name, file_content)

@router.delete("/jobs/{job}")
async def get_job(job: str):
    return dependencies.delete_workload(job)