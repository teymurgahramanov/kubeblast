from api.core import db, models
import bson
import os
from api.core import config

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
    
def create_job(job_data, file_name, current_user):
    job_data_dict = job_data.dict()

    job_data_dict["user"] = current_user.username
    job_data_dict["file_name"] = file_name

    try:
        models.Job(**job_data_dict)
    except Exception as e:
        return {"error": "Invalid job data"}
    
    try:
        db.mongo.jobs.insert_one(job_data_dict)
    except Exception as e:
        return False
    else:
        return True
    
def update_job(job_id, job_data: dict):
    job = get_job(job_id)
    if not job:
        return None
    
    job_data = {key: value for key, value in job_data.items() if value not in [None, "", [], {}, ()]}
    try:
        db.mongo.jobs.update_one({"_id": bson.objectid.ObjectId(job_id)}, {"$set": job_data})
    except Exception as e:
        return False
    else:
        updated_job = get_job(job_id)
        return updated_job

def delete_job(job_id, current_user):
    job = get_job(job_id)
    if not job:
        return {"error": "Job not found"}
    
    if current_user.role not in ["admin", "moderator"] and job.user != current_user.username:
        return {"error": "Permission denied"}
    
    try:
        db.mongo.jobs.delete_one({"_id": bson.objectid.ObjectId(job_id)})
    except Exception as e:
        print({"error": "Failed to delete job"})

    try:
        os.remove(os.path.join(config.config.UPLOAD_DIR, job.file_name))
    except Exception as e:
        print({"error": "Failed to delete job file"})

    try:
        client.BatchV1Api().delete_namespaced_job(
            namespace=namespace,
            name = job_name,
            propagation_policy = 'Foreground'
        )
        print(f"Job {job_name} deleted")
    except Exception as e:
        print(e)
        pass
    
    try: 
        client.CoreV1Api().delete_namespaced_config_map(
            namespace=namespace,
            name = job_name
        )
        print(f"ConfigMap {job_name} deleted")
    except Exception as e:
        print(e)
        pass

    try:
        label_selector = f"batch.kubernetes.io/job-name={job_name}"
        print(f"Finding Pods with label: {label_selector}")
        pods = client.CoreV1Api().list_namespaced_pod(namespace=namespace, label_selector=label_selector)

        for pod in pods.items:
            print(f"Deleting Pod: {pod.metadata.name}")
            client.CoreV1Api().delete_namespaced_pod(
                name = pod.metadata.name,
                namespace = namespace,
                body = client.V1DeleteOptions(),
                grace_period_seconds = 0
            )
    except Exception as e:
        print(e)
        pass
    
    return {"Workload": "deleted"}
