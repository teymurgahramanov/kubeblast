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
MONGO_URI = config.MONGO_URI
DB_NAME = config.MONGO_DB_NAME
COLLECTION_NAME = "jobs"
WORKER_WATCH_INTERVAL = config.WORKER_WATCH_INTERVAL

def get_current_namespace():
    try:
        with open("/var/run/secrets/kubernetes.io/serviceaccount/namespace", "r") as f:
            return f.read().strip()
    except FileNotFoundError:
        return "Namespace file not found"

current_namespace = get_current_namespace()

mongo_client = MongoClient(MONGO_URI)
db = mongo_client[DB_NAME]
jobs_collection = db[COLLECTION_NAME]

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
                    
                    if job.status.active:
                        k8s_status = "running"
                    elif job.status.succeeded:
                        k8s_status = "completed"
                    elif job.status.failed:
                        k8s_status = "failed"
                    else:
                        logger.warning(f"Unrecognized status for job {job_id}.")
                        continue  # Skip if status is not relevant
                    
                    # Fetch the job from MongoDB
                    mongo_job = jobs_collection.find_one({"_id": bson.ObjectId(job_id)})
                    if not mongo_job:
                        logger.warning(f"Job {job_id} not found in MongoDB.")
                        continue
                    
                    # Compare and update status if different
                    if mongo_job.get("status") != k8s_status:
                        update_result = jobs_collection.update_one(
                            {"_id": bson.ObjectId(job_id)},
                            {"$set": {"status": k8s_status}}
                        )
                        
                        if update_result.modified_count > 0:
                            logger.info(f"Updated MongoDB: {job_id} -> status {k8s_status}")
                        else:
                            logger.error(f"No changes made for job {job_id}.")
        
        except client.exceptions.ApiException as e:
            logger.error(f"Kubernetes API error: {e}")
        except Exception as e:
            logger.error(f"Unexpected error in job update process: {e}")
        
        sleep(WORKER_WATCH_INTERVAL)

if __name__ == "__main__":
    process_job_update()