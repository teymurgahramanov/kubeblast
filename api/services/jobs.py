from api.core import db, models
from fastapi import HTTPException
import bson
import os
from api.core import config, k8s
from kubernetes import client
from datetime import datetime

def get_jobs(current_user):
    if current_user.role in ["admin", "moderator"]:
        jobs = list(db.mongo.jobs.find({}))
    else:
        jobs = list(db.mongo.jobs.find({"user": current_user.username}))
    for job in jobs:
        job["_id"] = str(job["_id"])
    return jobs

def get_job(job_id):
    job = db.mongo.jobs.find_one({"_id": bson.objectid.ObjectId(job_id)})
    if not job:
        return HTTPException (status_code=404, detail="Job not found")
    job["_id"] = str(job["_id"])
    return job
    
def approve_job(job_id, job_status: str):
    job = get_job(job_id)
    if not job:
        return HTTPException(status_code=404, detail="Job not found")

    if job["status"] in ["running", "completed", "failed", "approved"]:
        return HTTPException(status_code=400, detail="Cannot update job in current state")
    
    db.mongo.jobs.update_one(
        {"_id": bson.objectid.ObjectId(job_id)},
        {"$set": {"status": job_status,"updated_at": datetime.now()}}
    )
    
    return get_job(job_id)

def delete_job(job_id, current_user):
    job = get_job(job_id)
    if not job:
        return HTTPException(status_code=404, detail="Job not found")
    
    if current_user.role not in ["admin", "moderator"] and job["user"] != current_user.username:
        return HTTPException (status_code=403, detail="You do not have permission to delete this job")

    try:
        os.remove(os.path.join(config.config.UPLOAD_DIR, job["file_name"]))
        print(f"File {job['file_name']} deleted")

        client.BatchV1Api(k8s.api_client).delete_namespaced_job(
            namespace=config.config.K8S_NAMESPACE,
            name = job["name"],
            propagation_policy = 'Foreground'
        )
        print(f"Job {job['name']} deleted")

        client.CoreV1Api(k8s.api_client).delete_namespaced_config_map(
            namespace=config.config.K8S_NAMESPACE,
            name = job["name"]
        )
        print(f"ConfigMap {job['name']} deleted")

        label_selector = f"batch.kubernetes.io/job-name={job['name']}"
        pods = client.CoreV1Api(k8s.api_client).list_namespaced_pod(namespace=config.config.K8S_NAMESPACE, label_selector=label_selector)
        for pod in pods.items:
            print(f"Deleting Pod: {pod.metadata.name}")
            client.CoreV1Api(k8s.api_client).delete_namespaced_pod(
                name = pod.metadata.name,
                namespace = config.config.K8S_NAMESPACE,
                body = client.V1DeleteOptions(k8s.api_client),
                grace_period_seconds = 0
            )
            
    except Exception as e:
        print(e)
    
    try:
        db.mongo.jobs.delete_one({"_id": bson.objectid.ObjectId(job_id)})
    except Exception as e:
        print(e)
        return HTTPException (status_code=500, detail="Error deleting job")
    else:
        return True