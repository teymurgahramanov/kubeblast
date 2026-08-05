import hashlib
from pathlib import Path
from time import sleep

from bson import ObjectId
from bson.errors import InvalidId
from config import config
from core import db, models
from core.log import logger
from fastapi import HTTPException
from services import auth, events, jmx, k8s, logs, verdicts
from services import files_fs as files

_PLAN_EDIT_STATUSES = frozenset({"ready", "completed", "failed"})


def _object_id(job_id: str) -> ObjectId:
    try:
        return ObjectId(job_id)
    except (InvalidId, TypeError) as exc:
        raise HTTPException(status_code=400, detail="Invalid job ID") from exc


def _transition_job(
    job_id: str,
    expected_statuses: tuple[models.JobStatus, ...],
    new_status: models.JobStatus,
    action: str,
) -> None:
    object_id = _object_id(job_id)
    result = db.mongo.jobs.update_one(
        {"_id": object_id, "status": {"$in": list(expected_statuses)}},
        {"$set": {"status": new_status}},
    )
    if result.matched_count:
        return

    current_job = db.mongo.jobs.find_one({"_id": object_id}, {"status": 1})
    if not current_job:
        raise HTTPException(status_code=404, detail="Job not found")

    expected = ", ".join(expected_statuses)
    raise HTTPException(
        status_code=409,
        detail=(
            f"Cannot {action} job in status '{current_job.get('status', 'unknown')}'; "
            f"expected: {expected}"
        ),
    )


def _set_failed_if_transition_is_current(job_id: str, transition_status: models.JobStatus) -> None:
    try:
        db.mongo.jobs.update_one(
            {"_id": _object_id(job_id), "status": transition_status},
            {"$set": {"status": "failed"}},
        )
    except Exception as error:  # noqa: BLE001
        logger.error(f"Failed to mark job {job_id} as failed: {error}")


def _create_event_best_effort(job_id: str, message: str) -> None:
    try:
        events.create_event(job_id, message)
    except Exception as error:  # noqa: BLE001
        logger.warning(f"Failed to record event for job {job_id}: {error}")


def _job_approve(current_user, job_owner_username: str) -> str:
    if job_owner_username == current_user.username:
        auto_approve = current_user.auto_approve
    else:
        owner = auth.get_user(job_owner_username)
        auto_approve = bool(owner.auto_approve) if owner else False
    if not config.LICENSE_VALID:
        return "ready"
    if auto_approve:
        return "ready"
    return "pending"


def get_jobs(
    current_user,
    status: str | None = None,
    owner: str | None = None,
    name: str | None = None,
    page: int = 1,
    page_size: int = 20,
    sort_by: str = "created_desc",
):
    query: dict = {}

    if status:
        query["status"] = status
    if owner:
        query["owner"] = owner

    # Restrict regular users to their own jobs
    if current_user.role == "user":
        query["owner"] = current_user.username

    # Treat `name` parameter as a free-text search across key fields
    # (name, owner), case-insensitive, partial match
    if name:
        regex = {"$regex": name, "$options": "i"}
        text_filter = {
            "$or": [
                {"name": regex},
                {"owner": regex},
            ]
        }
        if query:
            query = {"$and": [query, text_filter]}
        else:
            query = text_filter

    total = db.mongo.jobs.count_documents(query)

    # Apply sorting (default: newest first)
    sort_direction = -1
    if sort_by == "created_asc":
        sort_direction = 1

    cursor = db.mongo.jobs.find(query).sort("created_at", sort_direction)

    # Apply pagination
    if page_size:
        safe_page = max(page, 1)
        skip = (safe_page - 1) * page_size
        cursor = cursor.skip(skip).limit(page_size)

    jobs = list(cursor)
    for job in jobs:
        job["id"] = str(job["_id"])
    jobs = [models.Job(**job) for job in jobs]

    return jobs, total

def get_job(current_user, job_id):
    job = db.mongo.jobs.find_one({"_id": _object_id(job_id)})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if current_user.role not in ["admin", "moderator"] and job["owner"] != current_user.username:
        raise HTTPException(status_code=403, detail="Insufficent permissions")
    job["id"] = str(job["_id"])
    job = models.Job(**job)
    return job

def create_job(current_user, job_data):
    try:
        jmx.validate_jmx(job_data.file_content)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    current_jobs_count = db.mongo.jobs.count_documents({
        "owner": current_user.username
    })
    
    if current_jobs_count >= config.PER_USER_CURRENT_JOBS_LIMIT:
        raise HTTPException(
            status_code=400,
            detail=f"Jobs limit exceeded ({current_jobs_count}, limit is {config.PER_USER_CURRENT_JOBS_LIMIT})"
        )

    job_hash = hashlib.sha256(job_data.file_content + current_user.username.encode())
    for filename, content in sorted(job_data.parameter_files.items()):
        encoded_filename = filename.encode()
        job_hash.update(len(encoded_filename).to_bytes(4, "big"))
        job_hash.update(encoded_filename)
        job_hash.update(len(content).to_bytes(8, "big"))
        job_hash.update(content)
    job_name = job_hash.hexdigest()[:6]

    job = db.mongo.jobs.find_one({"name": job_name, "owner": current_user.username})
    if job:
        raise HTTPException(
            status_code=409,
            detail=f"The same job already exists: {job_name}"
        )
    
    job_status = _job_approve(current_user, current_user.username)

    job = {
        "name": job_name,
        "owner": current_user.username,
        "distributed": config.JMETER_MODE == "distributed",
        "description": job_data.description,
        "parameter_files": sorted(job_data.parameter_files),
        "status": job_status,
        "created_at": job_data.created_at
    }

    job_to_db = models.Job(**job)

    job_id: str | None = None
    try:
        result = db.mongo.jobs.insert_one(job_to_db.dict())
        job_id = str(result.inserted_id)
        logger.info(f"Job {job_id} inserted into Mongo")
        events.create_event(job_id, "Job created")
        if job_status == "pending":
            events.create_event(job_id, "Job is pending approval")
        files.create_file(job_id, job_data.file_content, "plan.jmx")
        for filename, content in job_data.parameter_files.items():
            files.create_file(job_id, content, filename)
        job = get_job(current_user, job_id)
        return job
    except Exception as e:  # noqa: BLE001
        logger.error(e)
        if job_id:
            events.create_event(job_id, f"Job creation failed: {e}")
            delete_job(current_user, job_id)
        raise HTTPException(status_code=500, detail="Failed to create job")


def update_job_plan(current_user, job_id: str, file_content: bytes):
    try:
        jmx.validate_jmx(file_content)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    job = get_job(current_user, job_id).dict()
    if job["status"] not in _PLAN_EDIT_STATUSES:
        raise HTTPException(
            status_code=400,
            detail="Plan can only be updated when the job is ready, completed, or failed",
        )

    new_status = _job_approve(current_user, job["owner"])

    try:
        files.create_file(job_id, file_content, "plan.jmx")
        db.mongo.jobs.update_one(
            {"_id": ObjectId(job_id)},
            {"$set": {"status": new_status}},
        )
        events.create_event(job_id, "Plan updated")
        if new_status == "pending":
            events.create_event(job_id, "Job is pending approval")
        return get_job(current_user, job_id)
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        logger.error(e)
        raise HTTPException(status_code=500, detail="Failed to update plan")


def start_job(current_user, job_id):
    job = get_job(current_user, job_id).model_dump()
    _transition_job(job_id, ("ready",), "starting", "start")

    try:
        logger.info(f"Scheduling workload for job {job_id}")
        _create_event_best_effort(job_id, "Workload scheduling started")
        k8s.schedule_workload(job_id, job["distributed"], job["parameter_files"])
        _create_event_best_effort(job_id, "Workload scheduled successfully")
        return models.JobCommandResponse(
            message="Job start accepted",
            job_id=job_id,
            status="starting",
        )
    except Exception as e:
        logger.error(f"Failed to schedule workload for job {job_id}: {e}")
        _set_failed_if_transition_is_current(job_id, "starting")
        _create_event_best_effort(job_id, f"Workload scheduling failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to schedule workload") from e


def retry_job(current_user, job_id):
    job = get_job(current_user, job_id).model_dump()
    _transition_job(job_id, ("completed", "failed"), "retrying", "retry")

    try:
        logger.info(f"Rescheduling job {job_id}")
        _create_event_best_effort(job_id, "Workload rescheduling started")
        logger.info(f"Deleting workload for job {job_id}")
        _create_event_best_effort(job_id, "Workload deletion started")
        try:
            logs.delete_logs_for_job(job_id)
        except Exception as e:  # noqa: BLE001
            logger.warning(f"Failed to delete job logs for {job_id}: {e}")
        if config.INFLUXDB_ENABLED:
            try:
                from services.influxdb import delete_job_metrics

                delete_job_metrics(job_id)
            except Exception as e:  # noqa: BLE001
                logger.warning(f"Failed to delete InfluxDB metrics for {job_id}: {e}")
        k8s.delete_workload(job_id)
        _create_event_best_effort(job_id, "Workload deleted")
        sleep(10)
        logger.info(f"Scheduling workload for job {job_id}")
        _create_event_best_effort(job_id, "Workload scheduling started")
        k8s.schedule_workload(job_id, job["distributed"], job["parameter_files"])
        _create_event_best_effort(job_id, "Workload scheduled successfully")
        return models.JobCommandResponse(
            message="Job retry accepted",
            job_id=job_id,
            status="retrying",
        )
    except Exception as e:
        logger.error(f"Failed to reschedule job {job_id}: {e}")
        _set_failed_if_transition_is_current(job_id, "retrying")
        _create_event_best_effort(job_id, f"Workload scheduling failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to retry job") from e


def stop_job(current_user, job_id):
    get_job(current_user, job_id)
    _transition_job(job_id, ("running",), "stopping", "stop")

    try:
        k8s.stop_workload(job_id)
        _create_event_best_effort(job_id, "Workload stop requested")
        logger.info(f"Graceful stop requested for job {job_id}")
        return models.JobCommandResponse(
            message="Job stop accepted",
            job_id=job_id,
            status="stopping",
        )
    except Exception as e:
        logger.error(f"Failed to stop job {job_id}: {e}")
        _set_failed_if_transition_is_current(job_id, "stopping")
        _create_event_best_effort(job_id, f"Workload stopping failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to stop job") from e


def get_job_verdict(current_user, job_id: str) -> models.JobVerdict:
    job = get_job(current_user, job_id)

    if job.status != "completed":
        reason = (
            "Job execution failed; no result verdict was evaluated."
            if job.status == "failed"
            else f"Job execution is not completed (status: {job.status})."
        )
        return models.JobVerdict(
            job_id=job_id,
            execution_status=job.status,
            verdict="not_evaluated",
            samples_total=0,
            samples_failed=0,
            error_rate=0.0,
            reason=reason,
        )

    result_path = Path(config.STORAGE_DIR) / job_id / "result.jtl"
    evaluation = verdicts.evaluate_jmeter_result(result_path)
    return models.JobVerdict(
        job_id=job_id,
        execution_status=job.status,
        verdict=evaluation.verdict,
        samples_total=evaluation.samples_total,
        samples_failed=evaluation.samples_failed,
        error_rate=evaluation.error_rate,
        reason=evaluation.reason,
    )

def delete_job(current_user, job_id):
    get_job(current_user, job_id).dict()

    k8s.delete_workload(job_id)

    files.delete_file(job_id)

    # Clean up associated job events and stored log lines
    try:
        events.delete_events_for_job(job_id)
    except Exception as e:  # noqa: BLE001
        logger.warning(f"Failed to delete job events for {job_id}: {e}")
    try:
        logs.delete_logs_for_job(job_id)
    except Exception as e:  # noqa: BLE001
        logger.warning(f"Failed to delete job logs for {job_id}: {e}")

    # Clean up associated InfluxDB metrics
    if config.INFLUXDB_ENABLED:
        try:
            from services.influxdb import delete_job_metrics

            delete_job_metrics(job_id)
        except Exception as e:  # noqa: BLE001
            logger.warning(f"Failed to delete InfluxDB metrics for {job_id}: {e}")
        
    db.mongo.jobs.delete_one({"_id": ObjectId(job_id)})
    
    return {"message": f"Job {job_id} deleted"}