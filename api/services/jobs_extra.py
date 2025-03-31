from fastapi import HTTPException
from core import db
import bson
from services import k8s, jobs
from time import sleep

def approve_job(current_user, job_id: str, approved: bool):
    job = jobs.get_job(current_user, job_id).dict()

    if job["status"] != "pending":
        raise HTTPException(status_code=400, detail="Cannot update job in current state")

    if approved:
        try:
            db.mongo.jobs.update_one(
                {"_id": bson.objectid.ObjectId(job_id)},
                {"$set": {"status": "approved"}}
            )
            k8s.schedule_workload(job_id,job["distributed"])
        except Exception as e:
            db.mongo.jobs.update_one(
                {"_id": bson.objectid.ObjectId(job_id)},
                {"$set": {"status": "pending"}}
            )
            raise HTTPException(status_code=500, detail="Failed to approve job")
    else: 
        db.mongo.jobs.update_one(
            {"_id": bson.objectid.ObjectId(job_id)},
            {"$set": {"status": "declined"}}
        )

    return jobs.get_job(current_user, job_id)

def retry_job(current_user, job_id):
    job = jobs.get_job(current_user, job_id).dict()

    if job["status"] in ["pending","declined","retrying"]:
        raise HTTPException(status_code=400, detail="Cannot reschedule job in current state")
    
    db.mongo.jobs.update_one(
        {"_id": bson.objectid.ObjectId(job_id)},
        {"$set": {"status": "retrying"}}
    )

    try:
        k8s.delete_workload(job_id)
        sleep(10)
        k8s.schedule_workload(job_id,job["distributed"])
    except Exception as e:
        db.mongo.jobs.update_one(
            {"_id": bson.objectid.ObjectId(job_id)},
            {"$set": {"status": "failed"}}
        )
        raise HTTPException(status_code=500, detail="Failed to retry job")

    return jobs.get_job(current_user, job_id)