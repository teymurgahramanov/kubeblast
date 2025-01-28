from fastapi import APIRouter

router = APIRouter()

@router.get("/jobs")
async def get_jobs():
    return "jobs"

@router.get("/jobs/{job}")
async def get_job(job: str):
    return job

@router.post("/jobs")
async def create_job():
    return "job created"

@router.delete("/jobs/{job}")
async def delete_job(job: str):
    return job