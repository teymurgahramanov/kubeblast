from core import db, models
from fastapi import HTTPException
import bson
from time import sleep
import hashlib
from config import config
from datetime import datetime
from core.log import logger
from services import k8s

from services import files_fs as files

def get_jobs(current_user, status: str = None, owner: str = None, name: str = None):
    query = {}
    
    if status:
        query["status"] = status
    if owner:
        query["owner"] = owner
    if name:
        query["name"] = name
    
    if current_user.role == "user":
        query["owner"] = current_user.username

    jobs = list(db.mongo.jobs.find(query))
    for job in jobs:
        job["id"] = str(job["_id"])
    jobs = [models.Job(**job) for job in jobs]
    return jobs

def get_job(current_user, job_id):
    job = db.mongo.jobs.find_one({"_id": bson.objectid.ObjectId(job_id)})
    if not job:
        raise HTTPException(status_code=404, detail=f"Job not found")
    if current_user.role not in ["admin", "moderator"] and job["owner"] != current_user.username:
        raise HTTPException(status_code=403, detail="Insufficent permissions")
    job["id"] = str(job["_id"])
    job = models.Job(**job)
    return job

def create_job(current_user, file_content, description, distributed):
    job_name = f"{hashlib.sha256(file_content+current_user.username.encode()).hexdigest()[:6]}"

    current_jobs_count = db.mongo.jobs.count_documents({
        "owner": current_user.username
    })
    
    if current_jobs_count >= config.PER_USER_CURRENT_JOBS_LIMIT:
        raise HTTPException(
            status_code=400,
            detail=f"Jobs limit exceeded ({current_jobs_count}, limit is {config.PER_USER_CURRENT_JOBS_LIMIT})"
        )

    job = db.mongo.jobs.find_one({"name": job_name, "owner": current_user.username})
    if job:
        raise HTTPException(
            status_code=409,
            detail=f"The same job already exists: {job_name}"
        )
    
    if not config.IS_PRO:
        job_status = "ready"
    elif current_user.auto_approve:
        job_status = "ready"
    else:
        job_status = "pending"

    job = models.Job(
        name=job_name,
        owner=current_user.username,
        description=description,
        distributed=distributed,
        status=job_status,
        created_at=datetime.now(),
    )

    try:
        result = db.mongo.jobs.insert_one(job.dict())
        job_id = str(result.inserted_id)
        file_name = "plan.jmx"
        files.create_file(job_id, file_content, file_name)
        return get_job(current_user, job_id)
    except Exception as e:
        logger.error(e)
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
        k8s.schedule_workload(job_id, job["distributed"])
        return {"message": f"Job {job_id} started"}
    except Exception as e:
        logger.error(f"Failed to schedule workload for job {job_id}: {e}")
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
        sleep(10)
        k8s.schedule_workload(job_id,job["distributed"])
        return {"message": f"Job {job_id} retried"}
    except Exception as e:
        db.mongo.jobs.update_one(
            {"_id": bson.objectid.ObjectId(job_id)},
            {"$set": {"status": "failed"}}
        )
        raise HTTPException(status_code=500, detail="Failed to retry job")

def delete_job(current_user, job_id):
    get_job(current_user, job_id).dict()

    k8s.delete_workload(job_id)

    files.delete_file(job_id)
        
    db.mongo.jobs.delete_one({"_id": bson.objectid.ObjectId(job_id)})
    
    return {"message": f"Job {job_id} deleted"}