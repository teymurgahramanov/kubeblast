import logging
from pymongo import MongoClient
from kubernetes import client, config as k8s_config, watch
from kubernetes.client.exceptions import ApiException
from config import config

# Logging Configuration
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

# MongoDB Configuration
MONGO_URI = config.MONGO_URI
DB_NAME = config.MONGO_DB_NAME
COLLECTION_NAME = "jobs"
NAMESPACE = config.K8S_NAMESPACE

# Load Kubernetes configuration
try:
    k8s_config.load_kube_config()  # Use load_incluster_config() if running inside a cluster
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

# Function to watch Kubernetes jobs and update MongoDB
def watch_k8s_jobs():
    batch_v1 = client.BatchV1Api()
    w = watch.Watch()

    logging.info("Starting to watch Kubernetes Jobs...")

    try:
        for event in w.stream(batch_v1.list_namespaced_job, namespace=NAMESPACE):
            job = event["object"]
            job_name = job.metadata.name
            labels = job.metadata.labels or {}

            # Extract job_id from labels
            job_id = labels.get("job_id")
            if not job_id:
                logging.warning(f"Skipping job {job_name}, no job_id label found.")
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

            # Update MongoDB job status
            update_result = jobs_collection.update_one({"_id": job_id}, {"$set": {"status": new_status}})

            if update_result.matched_count > 0:
                logging.info(f"Updated MongoDB: job_id {job_id} -> status {new_status}")
            else:
                logging.warning(f"MongoDB update failed: job_id {job_id} not found.")

    except ApiException as e:
        logging.error(f"Kubernetes API error: {e}")
    except Exception as e:
        logging.error(f"Unexpected error in job watcher: {e}")

# Run the watcher
watch_k8s_jobs()