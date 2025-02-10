import logging
import threading
from pymongo import MongoClient
from kubernetes import client, config, watch
from kubernetes.client.exceptions import ApiException
from config import config as app_config
from time import sleep

# Logging Configuration
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

# MongoDB Configuration
MONGO_URI = app_config.MONGO_URI
DB_NAME = app_config.MONGO_DB_NAME
COLLECTION_NAME = "jobs"
NAMESPACE = app_config.K8S_NAMESPACE
WATCH_INTERVAL = app_config.WATCH_INTERVAL

# Load Kubernetes configuration
try:
    config.load_kube_config()  # Use load_incluster_config() if running inside a cluster
    logging.info("Connected to Kubernetes cluster.")
except Exception as e:
    logging.error(f"Failed to load Kubernetes configuration: {e}")
    exit(1)

# Initialize MongoDB client
try:
    mongo_client = MongoClient(MONGO_URI)
    db = mongo_client[DB_NAME]
    jobs_collection = db[COLLECTION_NAME]
    logging.info("Connected to MongoDB.")
except Exception as e:
    logging.error(f"Failed to connect to MongoDB: {e}")
    exit(1)

# Function to process a single job update in a separate thread
def process_job_update(job):
    job_name = job.metadata.name
    labels = job.metadata.labels or {}

    # Extract job_id from labels
    job_id = labels.get("job_id")
    if not job_id:
        return  # Skip jobs without job_id label

    # Determine job status
    if job.status.active:
        new_status = "running"
    elif job.status.succeeded:
        new_status = "completed"
    elif job.status.failed:
        new_status = "failed"
    else:
        return  # Ignore other status changes

    # Update MongoDB job status
    update_result = jobs_collection.update_one({"_id": job_id}, {"$set": {"status": new_status}})

    if update_result.matched_count > 0:
        logging.info(f"Updated MongoDB: job_id {job_id} -> status {new_status}")
    else:
        logging.warning(f"MongoDB update failed: job_id {job_id} not found.")

# Function to watch Kubernetes jobs and spawn threads for processing
def watch_k8s_jobs():
    batch_v1 = client.BatchV1Api()
    w = watch.Watch()

    logging.info("Starting to watch Kubernetes Jobs...")

    try:
        for event in w.stream(batch_v1.list_namespaced_job, namespace=NAMESPACE):
            job = event["object"]

            # Filter jobs that have a 'job_id' label
            if not job.metadata.labels or "job-id" not in job.metadata.labels:
                continue

            thread = threading.Thread(target=process_job_update, args=(job,))
            thread.start()

    except ApiException as e:
        logging.error(f"Kubernetes API error: {e}")
    except Exception as e:
        logging.error(f"Unexpected error in job watcher: {e}")

    sleep(WATCH_INTERVAL)

# Run the watcher
watch_k8s_jobs()
