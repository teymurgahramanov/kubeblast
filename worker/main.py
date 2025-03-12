import os
import bson
import logging
from time import sleep
from kubernetes import client, config as k8s_config
from pymongo import MongoClient
from config import config as app_config

# Logging Configuration
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

# MongoDB Configuration
MONGO_URI = app_config.MONGO_URI
DB_NAME = app_config.MONGO_DB_NAME
COLLECTION_NAME = "jobs"
NAMESPACE = app_config.K8S_NAMESPACE
WORKER_WATCH_INTERVAL = app_config.WORKER_WATCH_INTERVAL

# Load Kubernetes Configuration
k8s_config.load_incluster_config()

# Initialize MongoDB Client
mongo_client = MongoClient(MONGO_URI)
db = mongo_client[DB_NAME]
jobs_collection = db[COLLECTION_NAME]

def get_k8s_job_status(job):
    """Determine the status of a Kubernetes Job."""
    if job.status.active:
        return "running"
    elif job.status.succeeded:
        return "completed"
    elif job.status.failed:
        return "failed"
    return None  # Unrecognized status

def process_job_update():
    """Continuously sync job statuses between Kubernetes and MongoDB."""
    batch_v1 = client.BatchV1Api()
    logging.info("Starting Kubernetes Job Updater...")
    
    while True:
        try:
            jobs = batch_v1.list_namespaced_job(namespace=NAMESPACE).items
            if not jobs:
                logging.info("No jobs found.")
            else:
                for job in jobs:
                    job_id = job.metadata.labels.get("jrunner/job-id")
                    if not job_id:
                        logging.warning(f"Job {job.metadata.name} does not have a job ID.")
                        continue
                    
                    # Determine the current job status in Kubernetes
                    k8s_status = get_k8s_job_status(job)
                    if not k8s_status:
                        logging.warning(f"Unrecognized status for job {job_id}.")
                        continue  # Skip if status is not relevant
                    
                    # Fetch the job from MongoDB
                    mongo_job = jobs_collection.find_one({"_id": bson.ObjectId(job_id)})
                    if not mongo_job:
                        logging.warning(f"Job {job_id} not found in MongoDB.")
                        continue
                    
                    # Compare and update status if different
                    if mongo_job.get("status") != k8s_status:
                        update_result = jobs_collection.update_one(
                            {"_id": bson.ObjectId(job_id)},
                            {"$set": {"status": k8s_status}}
                        )
                        
                        if update_result.modified_count > 0:
                            logging.info(f"Updated MongoDB: {job_id} -> status {k8s_status}")
                        else:
                            logging.error(f"No changes made for job {job_id}.")
        
        except client.exceptions.ApiException as e:
            logging.error(f"Kubernetes API error: {e}")
        except Exception as e:
            logging.error(f"Unexpected error in job update process: {e}")
        
        sleep(WORKER_WATCH_INTERVAL)

if __name__ == "__main__":
    process_job_update()