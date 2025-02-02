import time
import threading
import logging
from pymongo import MongoClient
from kubernetes import client, config, watch
from kubernetes.client.exceptions import ApiException
from concurrent.futures import ThreadPoolExecutor

# Logging Configuration
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

# MongoDB Configuration
MONGO_URI = "mongodb://localhost:27017"
DB_NAME = "mydatabase"
COLLECTION_NAME = "jobs"

# Kubernetes Namespace
NAMESPACE = "default"

# Polling interval (in seconds)
POLL_INTERVAL = 30  # Adjust as needed
MAX_CONCURRENT_JOBS = 3  # Maximum Kubernetes jobs that can run at once

# Load Kubernetes configuration
try:
    config.load_kube_config()  # For local development
    # config.load_incluster_config()  # Uncomment for in-cluster execution
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

# Function to get running Kubernetes jobs
def get_running_k8s_jobs():
    batch_v1 = client.BatchV1Api()
    try:
        jobs = batch_v1.list_namespaced_job(namespace=NAMESPACE)
        running_jobs = {job.metadata.name for job in jobs.items if job.status.active}
        return running_jobs
    except ApiException as e:
        logging.error(f"Error fetching Kubernetes jobs: {e}")
        return set()

# Function to create a Kubernetes Job
def create_k8s_job(job_data):
    batch_v1 = client.BatchV1Api()

    job_manifest = {
        "apiVersion": "batch/v1",
        "kind": "Job",
        "metadata": {
            "name": job_data["name"],
            "namespace": NAMESPACE
        },
        "spec": {
            "template": {
                "metadata": {
                    "labels": {"job-name": job_data["name"]}
                },
                "spec": {
                    "containers": [{
                        "name": "job-container",
                        "image": job_data.get("image", "busybox"),
                        "command": job_data.get("command", ["echo", "Hello, Kubernetes!"])
                    }],
                    "restartPolicy": "Never"
                }
            }
        }
    }

    try:
        batch_v1.create_namespaced_job(namespace=NAMESPACE, body=job_manifest)
        logging.info(f"Created Kubernetes Job: {job_data['name']}")

        # Update MongoDB job status to "running"
        jobs_collection.update_one({"_id": job_data["_id"]}, {"$set": {"status": "running"}})
        logging.info(f"Updated MongoDB status to 'running' for job {job_data['name']}")

        # Start a thread to watch job status
        threading.Thread(target=watch_k8s_job_status, args=(job_data["name"], job_data["_id"])).start()

    except ApiException as e:
        logging.error(f"Failed to create Kubernetes Job {job_data['name']}: {e}")

# Function to watch Kubernetes job status and update MongoDB
def watch_k8s_job_status(job_name, job_id):
    batch_v1 = client.BatchV1Api()
    w = watch.Watch()
    try:
        for event in w.stream(batch_v1.list_namespaced_job, namespace=NAMESPACE):
            job = event['object']
            if job.metadata.name == job_name:
                if job.status.succeeded:
                    logging.info(f"Kubernetes Job {job_name} completed successfully.")
                    jobs_collection.update_one({"_id": job_id}, {"$set": {"status": "completed"}})
                    w.stop()
                elif job.status.failed:
                    logging.error(f"Kubernetes Job {job_name} failed.")
                    jobs_collection.update_one({"_id": job_id}, {"$set": {"status": "failed"}})
                    w.stop()
    except ApiException as e:
        logging.error(f"Error watching job {job_name}: {e}")

# Continuous polling loop
while True:
    try:
        logging.info("Checking for new approved jobs...")

        # Get current running Kubernetes Jobs
        running_k8s_jobs = get_running_k8s_jobs()

        # Fetch approved jobs from MongoDB
        approved_jobs_cursor = jobs_collection.find({"status": "approved"}).sort("created_at", 1)

        jobs_to_run = []
        for job in approved_jobs_cursor:
            if len(running_k8s_jobs) >= MAX_CONCURRENT_JOBS:
                break
            if job["name"] not in running_k8s_jobs:
                jobs_to_run.append(job)
                running_k8s_jobs.add(job["name"])

        # Run job creation in parallel
        with ThreadPoolExecutor(max_workers=len(jobs_to_run)) as executor:
            executor.map(create_k8s_job, jobs_to_run)

        if not jobs_to_run:
            logging.info("No new jobs to process.")

    except Exception as e:
        logging.error(f"Unexpected error in main loop: {e}")

    # Wait before the next iteration
    logging.info(f"Sleeping for {POLL_INTERVAL} seconds...")
    time.sleep(POLL_INTERVAL)
