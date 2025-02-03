import time
import threading
import logging
from pymongo import MongoClient
from kubernetes import client, config, watch
from kubernetes.client.exceptions import ApiException
from concurrent.futures import ThreadPoolExecutor
from config import config
import os
from jinja2 import Template
import yaml

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

MONGO_URI = config.MONGO_URI
DB_NAME = config.MONGO_DB_NAME
COLLECTION_NAME = "jobs"

namespace = config.K8S_namespace
file_dir = config.UPLOAD_DIR
configmap_key = config.K8S_CONFIGMAP_KEY
job_template_path = os.path.join(os.path.dirname(__file__), "./job.yaml.j2")

POLL_INTERVAL = 30
MAX_CONCURRENT_JOBS = 3

try:
    config.load_incluster_config()
    logging.info("Connected to Kubernetes cluster.")
except Exception as e:
    logging.error(f"Failed to load Kubernetes configuration: {e}")
    exit(1)

try:
    mongo_client = MongoClient(MONGO_URI)
    db = mongo_client[DB_NAME]
    jobs_collection = db[COLLECTION_NAME]
    logging.info("Connected to MongoDB.")
except Exception as e:
    logging.error(f"Failed to connect to MongoDB: {e}")
    exit(1)

def get_running_k8s_jobs():
    client.BatchV1Api() = client.BatchV1Api()
    try:
        jobs = client.BatchV1Api().list_namespaced_job(namespace=namespace)
        running_jobs = {job.metadata.name for job in jobs.items if job.status.active}
        return running_jobs
    except ApiException as e:
        logging.error(f"Error fetching Kubernetes jobs: {e}")
        return set()

def create_k8s_job(job_data):

    file_path = os.path.join(file_dir, job_data["file_name"])

    try:
        with open(file_path, "r") as f:
            file_content = f.read()
    except Exception as e:
        logging.error(f"Failed to read file {file_path}: {e}")
        exit(1)

    configmap = client.V1ConfigMap(
        metadata=client.V1ObjectMeta(name=job_data["name"]),
        data={configmap_key: file_content.decode("utf-8")}
    )

    with open(job_template_path, 'r') as file:
        job_template_content = file.read()

    rendered_job = Template(job_template_content).render(
        name=job_data["name"],
        namespace=namespace,
        configmap_key=configmap_key
    )
    job_manifest = yaml.safe_load(rendered_job)

    try:
        # Create ConfigMap
        client.CoreV1Api().create_namespaced_config_map(namespace=namespace, body=configmap)
        logging.info(f"Created Kubernetes ConfigMap: {job_data['name']}")

        # Create Job
        client.BatchV1Api().create_namespaced_job(namespace=namespace, body=job_manifest)
        logging.info(f"Created Kubernetes Job: {job_data['name']}")

        # Update MongoDB job status to "running"
        jobs_collection.update_one({"_id": job_data["_id"]}, {"$set": {"status": "running"}})
        logging.info(f"Updated MongoDB status to 'running' for job {job_data['name']}")

        # Start a thread to watch job status
        threading.Thread(target=watch_k8s_job_status, args=(job_data["name"], job_data["_id"])).start()

    except ApiException as e:
        logging.error(f"Failed to create workload {job_data['name']}: {e}")

# Function to watch Kubernetes job status and update MongoDB
def watch_k8s_job_status(job_name, job_id):
    w = watch.Watch()
    try:
        for event in w.stream(client.BatchV1Api().list_namespaced_job, namespace=namespace):
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
