from typing import Annotated, Literal

from core import models
from fastapi import APIRouter, Body, Depends, Query, Response
from fastapi import status as http_status
from services import auth, jobs

router = APIRouter(prefix="/api/v1")


@router.get("/jobs", response_model=list[models.Job])
def list_jobs(
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


@router.get(
    "/jobs/{job_id}",
    response_model=models.Job,
    summary="Get job status",
    description="Poll this endpoint to watch the job status.",
)
def get_job(job_id: str, current_user: Annotated[models.User, Depends(auth.check_role([]))]):
    return jobs.get_job(current_user, job_id)


@router.get(
    "/jobs/{job_id}/status",
    response_model=models.JobVerdict,
    summary="Get job status",
)
def get_job_status(
    job_id: str,
    current_user: Annotated[models.User, Depends(auth.check_role([]))],
):
    return jobs.get_job_verdict(current_user, job_id)


@router.post(
    "/jobs",
    response_model=models.Job,
    summary="Create a job",
    description="Upload a JMeter JMX plan and optional CSV parameter files.",
)
def create_job(
    current_user: Annotated[models.User, Depends(auth.check_role([]))],
    job_data: Annotated[models.JobCreate, Depends(models.JobCreate.create_form)],
):
    return jobs.create_job(current_user, job_data)


@router.put("/jobs/{job_id}/plan", response_model=models.Job)
def update_job_plan(
    job_id: str,
    current_user: Annotated[models.User, Depends(auth.check_role([]))],
    body: bytes = Body(..., media_type="application/xml", description="Raw JMeter JMX document"),
):
    return jobs.update_job_plan(current_user, job_id, body)


@router.put(
    "/jobs/{job_id}/start",
    response_model=models.JobCommandResponse,
    status_code=http_status.HTTP_202_ACCEPTED,
    summary="Start a ready job",
    description="The job must be ready. Poll the job-status endpoint after starting it.",
)
def start_job(
    job_id: str,
    current_user: Annotated[models.User, Depends(auth.check_role([]))],
):
    return jobs.start_job(current_user, job_id)


@router.put(
    "/jobs/{job_id}/retry",
    response_model=models.JobCommandResponse,
    status_code=http_status.HTTP_202_ACCEPTED,
)
def retry_job(
    current_user: Annotated[models.User, Depends(auth.check_role([]))],
    job_id: str,
):
    return jobs.retry_job(current_user, job_id)


@router.put(
    "/jobs/{job_id}/stop",
    response_model=models.JobCommandResponse,
    status_code=http_status.HTTP_202_ACCEPTED,
)
def stop_job(
    current_user: Annotated[models.User, Depends(auth.check_role([]))],
    job_id: str,
):
    return jobs.stop_job(current_user, job_id)


@router.delete("/jobs/{job_id}", response_model=models.MessageResponse)
def delete_job(job_id: str, current_user: Annotated[models.User, Depends(auth.check_role([]))]):
    return jobs.delete_job(current_user, job_id)
