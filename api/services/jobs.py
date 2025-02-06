from api.core import db, models
from fastapi import HTTPException, Response
import bson
import os
import hashlib
from api.core import config, k8s
from kubernetes import client
from datetime import datetime
import logging
from jinja2 import Template
import yaml

def get_jobs(status: str = None, owner: str = None, name: str = None):
    query = {}
    
    if status:
        query["status"] = status
    if owner:
        query["owner"] = owner
    if name:
        query["name"] = name
    
    jobs = list(db.mongo.jobs.find(query))
    for job in jobs:
        job["id"] = str(job["_id"])
    
    return [models.JobFromDB(**job) for job in jobs]

def get_job(job_id):
    job = db.mongo.jobs.find_one({"_id": bson.objectid.ObjectId(job_id)})
    if not job:
        raise HTTPException(status_code=404, detail=f"Job not found")
    job["id"] = str(job["_id"])
    return models.JobFromDB(**job)

def create_job(file_content, description, username):
    job_name = f"{username}-{hashlib.sha256(file_content).hexdigest()[:6]}"

    job = db.mongo.jobs.find_one({"name": job_name})
    if job:
        raise HTTPException(status_code=400, detail=f"Job with the same plan file already exists: {job_name}")

    file_name = f"{job_name}.jmx"
    file_path = os.path.join(config.config.UPLOAD_DIR, file_name)
    with open(file_path, "wb") as f:
        f.write(file_content)

    job = models.Job(
        name=job_name,
        owner=username,
        description=description,
        status="pending",
        file_name=file_name,
        created_at=datetime.now()
    )

    result = db.mongo.jobs.insert_one(job.dict())

    return get_job(str(result.inserted_id))

    
def approve_job(job_id: str, approved: bool):
    job = get_job(job_id).dict()

    if job["status"] != "pending":
        raise HTTPException(status_code=400, detail="Cannot update job in current state")

    if approved:
        namespace = config.config.K8S_NAMESPACE
        file_dir = config.config.UPLOAD_DIR
        file_path = os.path.join(file_dir, job["file_name"])
        job_template_path = os.path.join(os.path.dirname(__file__), "./job.yaml.j2")

        with open(file_path, "r") as f:
            file_content = f.read()

        configmap = client.V1ConfigMap(
            metadata=client.V1ObjectMeta(name=job["name"]),
            data={"plan.jmx": file_content.decode("utf-8")}
        )

        with open(job_template_path, 'r') as file:
            job_template_content = file.read()

        rendered_job = Template(job_template_content).render(
            name=job["name"],
            namespace=namespace,
            configmap_key="plan.jmx"
        )
        job_manifest = yaml.safe_load(rendered_job)

        try:
            # Create ConfigMap
            client.CoreV1Api().create_namespaced_config_map(namespace=namespace, body=configmap)
            logging.info(f"Created Kubernetes ConfigMap: {job['name']}")

            # Create Job
            client.BatchV1Api().create_namespaced_job(namespace=namespace, body=job_manifest)
            logging.info(f"Created Kubernetes Job: {job['name']}")

        except Exception as e:
            logging.error(f"Failed to create workload {job['name']}: {e}")
            raise HTTPException(status_code=500, detail="Error creating workload")

        db.mongo.jobs.update_one(
            {"_id": bson.objectid.ObjectId(job_id)},
            {"$set": {"status": "approved","updated_at": datetime.now()}}
        )

    db.mongo.jobs.update_one(
        {"_id": bson.objectid.ObjectId(job_id)},
        {"$set": {"status": "declined","updated_at": datetime.now()}}
    )

    return get_job(job_id)

def delete_job(job_id, current_user):
    job = get_job(job_id).dict()
    
    if current_user.role not in ["admin", "moderator"] or job["user"] != current_user.username:
        raise HTTPException(status_code=403, detail="You do not have permission to delete this job")

    try:
        os.remove(os.path.join(config.config.UPLOAD_DIR, job["file_name"]))
        print(f"File {job['file_name']} deleted")

        client.BatchV1Api(k8s.api_client).delete_namespaced_job(
            namespace=config.config.K8S_NAMESPACE,
            name = job["name"],
            propagation_policy = 'Foreground'
        )
        print(f"Job {job['name']} deleted")

        client.CoreV1Api(k8s.api_client).delete_namespaced_config_map(
            namespace=config.config.K8S_NAMESPACE,
            name = job["name"]
        )
        print(f"ConfigMap {job['name']} deleted")

        label_selector = f"batch.kubernetes.io/job-name={job['name']}"
        pods = client.CoreV1Api(k8s.api_client).list_namespaced_pod(namespace=config.config.K8S_NAMESPACE, label_selector=label_selector)
        for pod in pods.items:
            print(f"Deleting Pod: {pod.metadata.name}")
            client.CoreV1Api(k8s.api_client).delete_namespaced_pod(
                name = pod.metadata.name,
                namespace = config.config.K8S_NAMESPACE,
                body = client.V1DeleteOptions(k8s.api_client),
                grace_period_seconds = 0
            )
    except Exception as e:
        print(e)
    
    db.mongo.jobs.delete_one({"_id": bson.objectid.ObjectId(job_id)})
    
    return Response(status_code=204, content={f"Job {job.name} deleted"})