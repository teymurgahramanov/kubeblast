from api.core import db, models
import bson
import os, hashlib
from api.core import config, k8s
from kubernetes import client

def get_jobs(current_user):
    if current_user.role in ["admin", "moderator"]:
        jobs = list(db.mongo.jobs.find({}))
    else:
        jobs = list(db.mongo.jobs.find({"user": current_user.username}))
    for job in jobs:
        job["_id"] = str(job["_id"])
    return {"jobs": jobs}

def get_job(job_id):
    try:
        job = db.mongo.jobs.find_one({"_id": bson.objectid.ObjectId(job_id)})
        if not job:
            return {"error": "Job not found"}
        job["_id"] = str(job["_id"])
        return job
    except:
        return {"error": "Invalid job ID"}
    
def create_job(name, description, file_name, current_user):

    job_data = {}
    job_data["name"] = name
    job_data["user"] = current_user.username
    job_data["description"] = description
    job_data["status"] = "pending"
    job_data["file_name"] = file_name

    try:
        models.Job(**job_data)
    except Exception as e:
        return {"error": "Invalid job data"}
    
    try:
        db.mongo.jobs.insert_one(job_data)
    except Exception as e:
        return False
    else:
        return True
    
def update_job(job_id, job_status: str):
    job = get_job(job_id)
    if not job:
        return None

    if job.status in ["running", "completed", "failed", "approved"]:
        return {"error": "Cannot update job in current state"}
    
    try:
        db.mongo.jobs.update_one(
            {"_id": bson.objectid.ObjectId(job_id)},
            {"$set": {"status": job_status}}
        )
    except Exception as e:
        return {"error": str(e)}
    else:
        return get_job(job_id)

def delete_job(job_id, current_user):
    job = get_job(job_id)
    if not job:
        return {"error": "Job not found"}
    
    if current_user.role not in ["admin", "moderator"] and job.user != current_user.username:
        return {"error": "Permission denied"}

    try:
        os.remove(os.path.join(config.config.UPLOAD_DIR, job.file_name))
    except Exception as e:
        print({"error": "Failed to delete job file"})

    try:
        client.BatchV1Api(k8s.client).delete_namespaced_job(
            namespace=config.config.K8S_NAMESPACE,
            name = job.name,
            propagation_policy = 'Foreground'
        )
        print(f"Job {job.name} deleted")
    except Exception as e:
        print(e)
        pass
    
    try: 
        client.CoreV1Api(k8s.client).delete_namespaced_config_map(
            namespace=config.config.K8S_NAMESPACE,
            name = job.name
        )
        print(f"ConfigMap {job.name} deleted")
    except Exception as e:
        print(e)
        pass

    try:
        label_selector = f"batch.kubernetes.io/job-name={job.name}"
        print(f"Finding Pods with label: {label_selector}")
        pods = client.CoreV1Api(k8s.client).list_namespaced_pod(namespace=config.config.K8S_NAMESPACE, label_selector=label_selector)

        for pod in pods.items:
            print(f"Deleting Pod: {pod.metadata.name}")
            client.CoreV1Api(k8s.client).delete_namespaced_pod(
                name = pod.metadata.name,
                namespace = config.config.K8S_NAMESPACE,
                body = client.V1DeleteOptions(k8s.client),
                grace_period_seconds = 0
            )
    except Exception as e:
        print(e)
        pass
    
    try:
        db.mongo.jobs.delete_one({"_id": bson.objectid.ObjectId(job_id)})
    except Exception as e:
        print({"error": "Failed to delete job"})
        
    return {"Workload": "deleted"}
