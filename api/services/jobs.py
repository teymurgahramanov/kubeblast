from api.core import db, models
from fastapi import HTTPException
import bson
import os
import hashlib
from api.core import config, k8s
from kubernetes import client
from datetime import datetime
import logging
from jinja2 import Template
import yaml
from api.services import files

def get_jobs(current_user, status: str = None, owner: str = None, name: str = None):
    query = {}
    
    if status:
        query["status"] = status
    if owner:
        query["owner"] = owner
    if name:
        query["name"] = name
    
    if current_user.role is "user":
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
            status_code=400,
            detail=f"Job with the same plan file already exists: {job_name}"
        )

    files.create_file(file_content,f"{job_name}.jmx")
    
    job = models.Job(
        name=job_name,
        owner=current_user.username,
        description=description,
        status="pending",
        created_at=datetime.now()
    )

    result = db.mongo.jobs.insert_one(job.dict())

    return get_job(current_user, str(result.inserted_id))

def approve_job(current_user, job_id: str, approved: bool):
    job = get_job(current_user, job_id).dict()

    if job["status"] != "pending":
        raise HTTPException(status_code=400, detail="Cannot update job in current state")

    if approved:
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
    job = get_job(current_user, job_id).dict()

    files.delete_file(f"{job['name']}.jmx")
        
    db.mongo.jobs.delete_one({"_id": bson.objectid.ObjectId(job_id)})
    
    return {f"Job {job['name']} deleted"}