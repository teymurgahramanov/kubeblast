import os
import bson
import logging
from core.log import logger
from core import k8s
from kubernetes import client
from pymongo import MongoClient
from config import config
from time import sleep

# MongoDB Configuration
MONGODB_URI = config.MONGODB_URI
DB_NAME = config.MONGODB_NAME
COLLECTION_NAME = "jobs"
WORKER_WATCH_INTERVAL = config.WORKER_WATCH_INTERVAL

def get_current_namespace():
    try:
        with open("/var/run/secrets/kubernetes.io/serviceaccount/namespace", "r") as f:
            return f.read().strip()
    except FileNotFoundError:
        return os.getenv("KUBEBLAST_NAMESPACE", "default")

current_namespace = get_current_namespace()

mongo_client = MongoClient(MONGODB_URI)
db = mongo_client[DB_NAME]
jobs_collection = db[COLLECTION_NAME]

core_v1 = client.CoreV1Api()

def determine_job_status(job) -> str:
    status = getattr(job, "status", None)
    if status is None:
        return "unknown"
    
    active = (getattr(status, "active", 0) or 0)
    succeeded = (getattr(status, "succeeded", 0) or 0)
    failed = (getattr(status, "failed", 0) or 0)
    conditions = getattr(status, "conditions", None) or []
    
    # Prefer terminal conditions first
    for cond in conditions:
        if getattr(cond, "type", None) == "Failed" and getattr(cond, "status", None) == "True":
            return "failed"
    for cond in conditions:
        if getattr(cond, "type", None) == "Complete" and getattr(cond, "status", None) == "True":
            return "completed"
    
    # Suspended jobs are not terminal; surface as 'starting' for UI continuity
    for cond in conditions:
        if getattr(cond, "type", None) == "Suspended" and getattr(cond, "status", None) == "True":
            return "starting"
    
    # Prefer actual Pod phases to distinguish Pending vs Running
    pods = []
    try:
        pods = core_v1.list_namespaced_pod(
            namespace=current_namespace,
            label_selector=f"job-name={job.metadata.name}"
        ).items
    except Exception as e:
        logger.debug(f"Pod lookup failed for job {job.metadata.name}: {e}")
    
    if pods:
        any_running = any(getattr(p.status, "phase", None) == "Running" for p in pods)
        any_failed = any(getattr(p.status, "phase", None) == "Failed" for p in pods)
        any_succeeded = any(getattr(p.status, "phase", None) == "Succeeded" for p in pods)
        any_pending = any(getattr(p.status, "phase", None) == "Pending" for p in pods)
        
        if any_running:
            return "running"
        if any_failed and not any_running and not any_succeeded:
            return "failed"
        if any_succeeded and not any_running:
            return "completed"
        if any_pending and not any_running:
            return "starting"
    
    # Live counters as fallback
    if active > 0:
        return "running"
    if succeeded > 0:
        return "completed"
    if failed > 0:
        return "failed"
    
    # Job exists but nothing has started yet
    return "starting"

def process_job_update():
    # Continuously sync job statuses between Kubernetes and MongoDB
    batch_v1 = client.BatchV1Api()
    logger.info("Starting worker")
    
    while True:
        try:
            jobs = batch_v1.list_namespaced_job(namespace=current_namespace).items
            if not jobs:
                logger.debug("No jobs found.")
            else:
                for job in jobs:
                    job_id = job.metadata.labels.get("kubeblast/job-id")
                    if not job_id:
                        logger.warning(f"Job {job.metadata.name} does not have a job ID.")
                        continue
                    
                    k8s_status = determine_job_status(job)

                    if k8s_status == "unknown":
                        logger.warning(f"Unrecognized status for job {job_id}.")
                        continue
                    else:
                        logger.info(f"Job {job_id} status: {k8s_status}")
                    
                    try:
                        update_result = jobs_collection.update_one(
                            {"_id": bson.ObjectId(job_id)},
                            {"$set": {"status": k8s_status}}
                        )
                        if update_result.modified_count > 0:
                            logger.info(f"Updated MongoDB: {job_id} -> status {k8s_status}")
                        else:
                            logger.debug(f"No update needed for job {job_id} (already has status {k8s_status})")
                    except bson.errors.InvalidId as e:
                        logger.error(f"Invalid job ID format {job_id}: {e}")
                        continue
                    except Exception as e:
                        logger.error(f"Failed to update MongoDB for job {job_id}: {e}")
                        continue
        except client.exceptions.ApiException as e:
            logger.error(f"Kubernetes API error: {e}")
        except Exception as e:
            logger.error(f"Unexpected error in job update process: {e}")
        
        sleep(WORKER_WATCH_INTERVAL)

if __name__ == "__main__":
    process_job_update()