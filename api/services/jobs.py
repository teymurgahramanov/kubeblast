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

def get_jobs(current_user, status: str = None, owner: str = None, name: str = None):
    query = {}
    
    if status:
        query["status"] = status
    if owner:
        query["owner"] = owner
    if name:
        query["name"] = name
    
    if current_user.role is "user":
        query["owner"] = current_user.username

    jobs = list(db.mongo.jobs.find(query))
    for job in jobs:
        job["id"] = str(job["_id"])
    print(jobs)
    return [models.JobFromDB(**job) for job in jobs]

def get_job(current_user, job_id):
    job = db.mongo.jobs.find_one({"_id": bson.objectid.ObjectId(job_id)})
    if not job:
        raise HTTPException(status_code=404, detail=f"Job not found")
    if current_user.role not in ["admin", "moderator"] and job["owner"] != current_user.username:
        raise HTTPException(status_code=403, detail="Insufficent permissions")
    job["id"] = str(job["_id"])
    print(job)
    return models.JobFromDB(**job)

def create_job(current_user, file_content, description):
    job_name = f"{current_user.username}-{hashlib.sha256(file_content).hexdigest()[:6]}"

    pending_jobs_count = db.mongo.jobs.count_documents({
        "status": "pending",
        "owner": current_user.username
    })
    if pending_jobs_count > config.config.PENDING_JOBS_LIMIT:
        raise HTTPException(status_code=400, detail=f"Too many pending jobs ({pending_jobs_count} pending, limit is {config.config.PENDING_JOBS_LIMIT})")


    job = db.mongo.jobs.find_one({"name": job_name})
    if job:
        raise HTTPException(status_code=400, detail=f"Job with the same plan file already exists: {job_name}")

    file_name = f"{job_name}.jmx"
    file_path = os.path.join(config.config.PLAN_DIR, file_name)
    with open(file_path, "wb") as f:
        f.write(file_content)

    job = models.Job(
        name=job_name,
        owner=current_user.username,
        description=description,
        status="pending",
        created_at=datetime.now()
    )

    result = db.mongo.jobs.insert_one(job.dict())

    return get_job(current_user, str(result.inserted_id))

    
def approve_job(current_user, job_id: str, approved: bool):
    job = get_job(current_user, job_id).dict()

    if job["status"] != "pending":
        raise HTTPException(status_code=400, detail="Cannot update job in current state")

    if approved:
        namespace = config.config.K8S_NAMESPACE
        file_path = os.path.join(config.config.PLAN_DIR, job["file_name"])
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
            {"$set": {"status": "approved"}}
        )
    else: 
        db.mongo.jobs.update_one(
            {"_id": bson.objectid.ObjectId(job_id)},
            {"$set": {"status": "declined"}}
        )

    return get_job(current_user, job_id)

def delete_job(current_user, job_id):
    job = get_job(current_user, job_id).dict()

    try:
        os.remove(os.path.join(config.config.PLAN_DIR, job["file_name"]))
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