from typing import Annotated, Literal

from core import models
from fastapi import APIRouter, BackgroundTasks, Body, Depends, Query, Response
from services import auth, jobs

router = APIRouter(prefix="/api/v1")

@router.get("/jobs", response_model=list[models.Job])
async def list_jobs(
    current_user: Annotated[models.User, Depends(auth.check_role([]))],
    response: Response,
    status: str | None = Query(None),
    owner: str | None = Query(None),
    name: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    sort_by: Literal["created_desc", "created_asc"] = Query("created_desc"),
    ):
    jobs_list, total = jobs.get_jobs(
        current_user,
        status=status,
        owner=owner,
        name=name,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
    )
    response.headers["X-Total-Count"] = str(total)
    response.headers["X-Page"] = str(page)
    response.headers["X-Page-Size"] = str(page_size)
    return jobs_list

@router.get("/jobs/{job_id}", response_model=models.Job)
async def get_job(job_id: str, current_user: Annotated[models.User, Depends(auth.check_role([]))]):
    return jobs.get_job(current_user, job_id)

@router.post("/jobs", response_model=models.Job)
async def create_job(
    current_user: Annotated[models.User, Depends(auth.check_role([]))],
    job_data: Annotated[models.JobCreate, Depends(models.JobCreate.create_form)],
    ):
    return jobs.create_job(current_user, job_data)

@router.put("/jobs/{job_id}/plan", response_model=models.Job)
async def update_job_plan(
    job_id: str,
    current_user: Annotated[models.User, Depends(auth.check_role([]))],
    body: bytes = Body(...),
):
    return jobs.update_job_plan(current_user, job_id, body)

@router.put("/jobs/start/{job_id}")
async def start_job(job_id: str, background_tasks: BackgroundTasks, current_user: Annotated[models.User, Depends(auth.check_role([]))]):
    background_tasks.add_task(jobs.start_job, current_user, job_id)
    return {"message": "Starting job"}

@router.put("/jobs/retry/{job_id}")
async def retry_job(
    current_user: Annotated[models.User, Depends(auth.check_role([]))],
    job_id: str,
    background_tasks: BackgroundTasks
    ):
    background_tasks.add_task(jobs.retry_job, current_user, job_id)
    return {"message": "Retrying job"}

@router.put("/jobs/stop/{job_id}")
async def stop_job(
    current_user: Annotated[models.User, Depends(auth.check_role([]))],
    job_id: str,
    background_tasks: BackgroundTasks
    ):
    background_tasks.add_task(jobs.stop_job, current_user, job_id)
    return {"message": "Stopping job"}

@router.delete("/jobs/{job_id}")
async def delete_job(job_id: str, current_user: Annotated[models.User, Depends(auth.check_role([]))]):
    return jobs.delete_job(current_user, job_id)