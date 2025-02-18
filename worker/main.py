import os
import yaml
import bson
import logging
import boto3
from jinja2 import Template
from kubernetes import client, config as k8s_config
from pymongo import MongoClient
from config import config as app_config
from time import sleep
from concurrent.futures import ThreadPoolExecutor

# Logging Configuration
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

# MongoDB Configuration
MONGO_URI = app_config.MONGO_URI
DB_NAME = app_config.MONGO_DB_NAME
COLLECTION_NAME = "jobs"
NAMESPACE = app_config.K8S_NAMESPACE
WORKER_WATCH_INTERVAL = app_config.WORKER_WATCH_INTERVAL

# Load Kubernetes Configuration
k8s_config.load_kube_config()
#k8s_config.load_incluster_config()

# Initialize MongoDB Client
mongo_client = MongoClient(MONGO_URI)
db = mongo_client[DB_NAME]
jobs_collection = db[COLLECTION_NAME]

def process_job_update():
    batch_v1 = client.BatchV1Api()

    logging.info("Starting Kubernetes Job Updater...")
    while True:
        try:
            jobs = batch_v1.list_namespaced_job(namespace=NAMESPACE).items
            if not jobs:
                logging.info("No jobs")
                continue
            else:
                for job in jobs:
                    job_id = job.metadata.labels.get("job-id")
                    if not job_id:
                        continue

                    # Determine job status
                    if job.status.active:
                        new_status = "running"
                    elif job.status.succeeded:
                        new_status = "completed"
                    elif job.status.failed:
                        new_status = "failed"
                    else:
                        continue  # Ignore other status changes
                    
                    update_result = jobs_collection.update_one(
                        {"_id": bson.ObjectId(job_id)},
                        {"$set": {"status": new_status}}
                    )
                    
                    if update_result.matched_count > 0:
                        logging.info(f"Updated MongoDB: {job_id} -> status {new_status}")
                    else:
                        logging.warning(f"MongoDB update failed: {job_id} not found.")
    
        except client.exceptions.ApiException as e:
            logging.error(f"Kubernetes API error: {e}")
        except Exception as e:
            logging.error(f"Unexpected error in job update process: {e}")
        
        sleep(WORKER_WATCH_INTERVAL)


if __name__ == "__main__":
    with ThreadPoolExecutor(max_workers=3) as executor:
        executor.submit(process_job_creation)
        executor.submit(process_job_update)
        executor.submit(process_job_cleanup)
