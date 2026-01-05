from core import db, models
from fastapi import HTTPException
import bson
from time import sleep
import hashlib
from config import config
from datetime import datetime
from core.log import logger
from services import k8s, events

from services import files_fs as files

def get_jobs(
    current_user,
    status: str = None,
    owner: str = None,
    name: str = None,
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
    job = db.mongo.jobs.find_one({"_id": bson.objectid.ObjectId(job_id)})
    if not job:
        raise HTTPException(status_code=404, detail=f"Job not found")
    if current_user.role not in ["admin", "moderator"] and job["owner"] != current_user.username:
        raise HTTPException(status_code=403, detail="Insufficent permissions")
    job["id"] = str(job["_id"])
    job = models.Job(**job)
    return job

def create_job(current_user, job_data):

    current_jobs_count = db.mongo.jobs.count_documents({
        "owner": current_user.username
    })
    
    if current_jobs_count >= config.PER_USER_CURRENT_JOBS_LIMIT:
        raise HTTPException(
            status_code=400,
            detail=f"Jobs limit exceeded ({current_jobs_count}, limit is {config.PER_USER_CURRENT_JOBS_LIMIT})"
        )

    job_name = f"{hashlib.sha256(job_data.file_content+current_user.username.encode()).hexdigest()[:6]}"

    job = db.mongo.jobs.find_one({"name": job_name, "owner": current_user.username})
    if job:
        raise HTTPException(
            status_code=409,
            detail=f"The same job already exists: {job_name}"
        )
    
    if not config.LICENSE_VALID:
        job_status = "ready"
    elif current_user.auto_approve:
        job_status = "ready"
    else:
        job_status = "pending"

    job = {
        "name": job_name,
        "owner": current_user.username,
        "distributed": bool(getattr(config, "MODE_DISTRIBUTED", False)),
        "description": job_data.description,
        "status": job_status,
        "created_at": job_data.created_at
    }

    job_to_db = models.Job(**job)

    try:
        job_id = None
        result = db.mongo.jobs.insert_one(job_to_db.dict())
        job_id = str(result.inserted_id)
        logger.info(f"Job {job_id} inserted into Mongo")
        events.create_event(job_id, "Job created")
        file_name = "plan.jmx"
        files.create_file(job_id, job_data.file_content, file_name)
        job = get_job(current_user, job_id)
        return job
    except Exception as e:
        logger.error(e)
        if "job_id" in locals() and job_id:
            events.create_event(job_id, f"Job creation failed: {e}")
            delete_job(current_user, job_id)
        raise HTTPException(status_code=500, detail="Failed to create job")


def start_job(current_user, job_id):
    job = get_job(current_user, job_id).dict()
    if job["status"] != "ready":
        raise HTTPException(status_code=400, detail="Cannot start job that is not ready")
    try:
        db.mongo.jobs.update_one(
            {"_id": bson.objectid.ObjectId(job_id)},
            {"$set": {"status": "starting"}}
        )
        logger.info(f"Scheduling workload for job {job_id}")
        events.create_event(job_id, "Workload scheduling started")
        k8s.schedule_workload(job_id, job["distributed"])   
        events.create_event(job_id, "Workload scheduled successfully")
        return {"message": f"Job {job_id} started"}
    except Exception as e:
        logger.error(f"Failed to schedule workload for job {job_id}: {e}")
        events.create_event(job_id, f"Workload scheduling failed: {e}")
        db.mongo.jobs.update_one(
            {"_id": bson.objectid.ObjectId(job_id)},
            {"$set": {"status": "failed"}}
        )
        raise HTTPException(status_code=500, detail="Failed to schedule workload")

def retry_job(current_user, job_id):
    job = get_job(current_user, job_id).dict()

    if job["status"] in ["pending","declined"]:
        raise HTTPException(status_code=400, detail="Cannot reschedule job in current state")

    try:
        db.mongo.jobs.update_one(
            {"_id": bson.objectid.ObjectId(job_id)},
            {"$set": {"status": "retrying"}}
        )
        k8s.delete_workload(job_id)
        events.create_event(job_id, "Workload deleted")
        sleep(10)
        k8s.schedule_workload(job_id,job["distributed"])
        events.create_event(job_id, "Workload scheduled successfully")
        return {"message": f"Job {job_id} retried"}
    except Exception as e:
        db.mongo.jobs.update_one(
            {"_id": bson.objectid.ObjectId(job_id)},
            {"$set": {"status": "failed"}}
        )
        events.create_event(job_id, f"Workload scheduling failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to retry job")

def stop_job(current_user, job_id):
    job = get_job(current_user, job_id).dict()

    if job["status"] != "running":
        raise HTTPException(status_code=400, detail="Can only stop running jobs")

    try:
        db.mongo.jobs.update_one(
            {"_id": bson.objectid.ObjectId(job_id)},
            {"$set": {"status": "stopping"}}
        )
        k8s.stop_workload(job_id)
        events.create_event(job_id, "Workload stopped")
        logger.info(f"Job {job_id} stopped gracefully")
        db.mongo.jobs.update_one(
            {"_id": bson.objectid.ObjectId(job_id)},
            {"$set": {"status": "completed"}}
        )
        return {"message": f"Job {job_id} stopped"}
    except Exception as e:
        logger.error(f"Failed to stop job {job_id}: {e}")
        events.create_event(job_id, f"Workload stopping failed: {e}")
        db.mongo.jobs.update_one(
            {"_id": bson.objectid.ObjectId(job_id)},
            {"$set": {"status": "failed"}}
        )
        raise HTTPException(status_code=500, detail="Failed to stop job")

def delete_job(current_user, job_id):
    get_job(current_user, job_id).dict()

    k8s.delete_workload(job_id)

    files.delete_file(job_id)

    # Clean up associated job events
    try:
        events.delete_events_for_job(job_id)
    except Exception as e:
        logger.warning(f"Failed to delete job events for {job_id}: {e}")
        
    db.mongo.jobs.delete_one({"_id": bson.objectid.ObjectId(job_id)})
    
    return {"message": f"Job {job_id} deleted"}