from api.core import db, models
from fastapi import HTTPException
import bson
import os
import hashlib
from api.core import config
from kubernetes import client
from datetime import datetime
import logging
from jinja2 import Template
import yaml
from api.services import files, k8s

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
    return [models.JobFromDB(**job) for job in jobs]

def get_job(current_user, job_id):
    job = db.mongo.jobs.find_one({"_id": bson.objectid.ObjectId(job_id)})
    if not job:
        raise HTTPException(status_code=404, detail=f"Job not found")
    if current_user.role not in ["admin", "moderator"] and job["owner"] != current_user.username:
        raise HTTPException(status_code=403, detail="Insufficent permissions")
    job["id"] = str(job["_id"])
    return models.JobFromDB(**job)

def create_job(current_user, file_content, description):
    job_name = f"{current_user.username}-{hashlib.sha256(file_content).hexdigest()[:6]}"

    pending_jobs_count = db.mongo.jobs.count_documents({
        "status": "pending",
        "owner": current_user.username
    })
    
    if pending_jobs_count > config.config.PENDING_JOBS_LIMIT:
        raise HTTPException(
            status_code=400,
            detail=f"Too many pending jobs ({pending_jobs_count} pending, limit is {config.config.PENDING_JOBS_LIMIT})"
        )

    job = db.mongo.jobs.find_one({"name": job_name})
    if job:
        raise HTTPException(
            status_code=409,
            detail=f"Job with the same plan file already exists: {job_name}"
        )
    
    job = models.Job(
        name=job_name,
        owner=current_user.username,
        description=description,
        status="pending",
        created_at=datetime.now()
    )

    try:
        result = db.mongo.jobs.insert_one(job.dict())
    except Exception as e:
        print(e)
        raise HTTPException(status_code=500, detail="Failed to create job")

    try:
        file_name = f"{str(result.inserted_id)}/plan.jmx"
        files.create_file(file_content,file_name)
    except Exception as e:
        print(e)
        db.mongo.jobs.delete_one({"_id": bson.objectid.ObjectId(result.inserted_id)})
        raise HTTPException(status_code=500, detail="Failed to create job")

    return get_job(current_user, str(result.inserted_id))

def approve_job(current_user, job_id: str, approved: bool):
    job = get_job(current_user, job_id).dict()

    if job["status"] != "pending":
        raise HTTPException(status_code=400, detail="Cannot update job in current state")

    if approved:
        k8s.schedule_workload(job_id)
        db.mongo.jobs.update_one(
            {"_id": bson.objectid.ObjectId(job_id)},
            {"$set": {"status": "approved"}}
        )
    else: 
        db.mongo.jobs.update_one(
            {"_id": bson.objectid.ObjectId(job_id)},
            {"$set": {"status": "declined"}}
        )

    return get_job(current_user, job_id)

def delete_job(current_user, job_id):

    k8s.delete_workload(job_id)

    files.delete_file(job_id)
        
    db.mongo.jobs.delete_one({"_id": bson.objectid.ObjectId(job_id)})
    
    return {f"Job {job_id} deleted"}

def reschedule_job(current_user, job_id):
    job = get_job(current_user, job_id).dict()

    if job["status"] in ["pending","declined"]:
        raise HTTPException(status_code=400, detail="Cannot reschedule job in current state")

    k8s.delete_workload(job_id)
    k8s.schedule_workload(job_id)

    return get_job(current_user, job_id)