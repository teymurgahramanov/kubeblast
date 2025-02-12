import os
import yaml
import bson
import logging
import boto3
from jinja2 import Template
from kubernetes import client
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
WATCH_INTERVAL = app_config.WATCH_INTERVAL

# S3 Configuration
S3_BUCKET = app_config.S3_BUCKET
S3_REGION = app_config.S3_REGION
S3_ACCESS_KEY = app_config.S3_ACCESS_KEY
S3_SECRET_KEY = app_config.S3_SECRET_KEY

# Initialize S3 Client
s3_client = boto3.client(
    "s3",
    region_name=S3_REGION,
    aws_access_key_id=S3_ACCESS_KEY,
    aws_secret_access_key=S3_SECRET_KEY
)

# Load Kubernetes Configuration
try:
    client.config.load_kube_config()
    logging.info("Connected to Kubernetes cluster.")
except Exception as e:
    logging.error(f"Failed to load Kubernetes configuration: {e}")
    exit(1)

# Initialize MongoDB Client
try:
    mongo_client = MongoClient(MONGO_URI)
    db = mongo_client[DB_NAME]
    jobs_collection = db[COLLECTION_NAME]
    logging.info("Connected to MongoDB.")
except Exception as e:
    logging.error(f"Failed to connect to MongoDB: {e}")
    exit(1)


def read_file_from_s3(file_key):
    """Reads file content from S3."""
    try:
        response = s3_client.get_object(Bucket=S3_BUCKET, Key=file_key)
        return response["Body"].read().decode("utf-8")  # Convert bytes to string
    except Exception as e:
        logging.error(f"Failed to read file {file_key} from S3: {e}")
        return None


def create_k8s_job(job_data):
    """Creates a Kubernetes job with a ConfigMap for the JMX plan."""
    job_id = str(job_data["_id"])
    job_name = job_data["name"]
    namespace = app_config.K8S_NAMESPACE
    s3_file_key = f"{job_name}.jmx"  # S3 object key
    job_template_path = os.path.join(os.path.dirname(__file__), "./job.yaml.j2")

    # Read the JMX file from S3
    file_content = read_file_from_s3(s3_file_key)
    if not file_content:
        logging.error(f"Skipping job {job_name}, JMX file not found in S3.")
        return

    # Create ConfigMap
    configmap = client.V1ConfigMap(
        metadata=client.V1ObjectMeta(name=job_name, labels={"job-id": job_id}),
        data={"plan.jmx": file_content}
    )

    # Render Job YAML from Jinja2 template
    try:
        with open(job_template_path, 'r') as file:
            job_template_content = file.read()

        rendered_job = Template(job_template_content).render(
            name=job_name,
            namespace=namespace,
            job_id=job_id,
            configmap_key="plan.jmx"
        )
        job_manifest = yaml.safe_load(rendered_job)
    except Exception as e:
        logging.error(f"Failed to render job template for {job_name}: {e}")
        return

    # Kubernetes API Clients
    core_v1 = client.CoreV1Api()
    batch_v1 = client.BatchV1Api()

    try:
        # Create ConfigMap
        core_v1.create_namespaced_config_map(namespace=namespace, body=configmap)
        logging.info(f"Created Kubernetes ConfigMap: {job_name}")

        # Create Job
        batch_v1.create_namespaced_job(namespace=namespace, body=job_manifest)
        logging.info(f"Created Kubernetes Job: {job_name}")

        # Update MongoDB status to 'scheduled'
        jobs_collection.update_one(
            {"_id": bson.ObjectId(job_id)},
            {"$set": {"status": "scheduled"}}
        )
    except Exception as e:
        logging.error(f"Failed to create workload {job_name}: {e}")


def process_job_creation():
    """Fetches approved jobs from MongoDB and creates Kubernetes jobs."""
    while True:
        try:
            approved_jobs = jobs_collection.find({"status": "approved"}).sort("created_at",1)
            for job_data in approved_jobs:
                create_k8s_job(job_data)
        except Exception as e:
            logging.error(f"Error in job creation process: {e}")

        sleep(WATCH_INTERVAL)


def process_job_update():
    """Watches Kubernetes jobs and updates their status in MongoDB."""
    batch_v1 = client.BatchV1Api()
    w = client.watch.Watch()
    logging.info("Starting Kubernetes Job Watcher...")

    while True:
        try:
            for event in w.stream(batch_v1.list_namespaced_job, namespace=NAMESPACE):
                job = event["object"]
                job_id = job.metadata.labels.get("job_id")
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
                    logging.info(f"Updated MongoDB: job_id {job_id} -> status {new_status}")
                else:
                    logging.warning(f"MongoDB update failed: job_id {job_id} not found.")
        except client.exceptions.ApiException as e:
            logging.error(f"Kubernetes API error: {e}")
        except Exception as e:
            logging.error(f"Unexpected error in job update process: {e}")

        sleep(WATCH_INTERVAL)


def process_job_cleanup():
    """Deletes Kubernetes jobs that are no longer in MongoDB."""
    batch_v1 = client.BatchV1Api()
    logging.info("Starting Kubernetes Job Cleanup...")

    while True:
        try:
            k8s_jobs = batch_v1.list_namespaced_job(namespace=NAMESPACE).items
            mongo_job_ids = {str(job["_id"]) for job in jobs_collection.find({}, {"_id": 1})}

            for job in k8s_jobs:
                job_id = job.metadata.labels.get("job_id")
                if job_id and job_id not in mongo_job_ids:
                    try:
                        batch_v1.delete_namespaced_job(
                            name=job.metadata.name,
                            namespace=NAMESPACE,
                            body=client.V1DeleteOptions(propagation_policy="Foreground"),
                        )
                        logging.info(f"Deleted orphaned Kubernetes job: {job.metadata.name}")
                    except client.exceptions.ApiException as e:
                        logging.error(f"Failed to delete job {job.metadata.name}: {e}")
        except Exception as e:
            logging.error(f"Error in job cleanup process: {e}")

        sleep(WATCH_INTERVAL)


if __name__ == "__main__":
    with ThreadPoolExecutor(max_workers=3) as executor:
        executor.submit(process_job_creation)
        executor.submit(process_job_update)
        executor.submit(process_job_cleanup)
