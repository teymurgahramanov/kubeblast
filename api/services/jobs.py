from api.core import db, models
from fastapi import HTTPException
import bson
import os
import hashlib
from api.core import config, k8s
from kubernetes import client
from datetime import datetime
import logging
from jinja2 import Template
import yaml
from api.services import files

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
    return [models.JobFromDB(**job) for job in jobs]

def get_job(current_user, job_id):
    job = db.mongo.jobs.find_one({"_id": bson.objectid.ObjectId(job_id)})
    if not job:
        raise HTTPException(status_code=404, detail=f"Job not found")
    if current_user.role not in ["admin", "moderator"] and job["owner"] != current_user.username:
        raise HTTPException(status_code=403, detail="Insufficent permissions")
    job["id"] = str(job["_id"])
    return models.JobFromDB(**job)

def create_job(current_user, file_content, description):
    job_name = f"{current_user.username}-{hashlib.sha256(file_content).hexdigest()[:6]}"
    file_name = f"{job_name}.jmx"

    pending_jobs_count = db.mongo.jobs.count_documents({
        "status": "pending",
        "owner": current_user.username
    })
    if pending_jobs_count > config.config.PENDING_JOBS_LIMIT:
        raise HTTPException(
            status_code=400,
            detail=f"Too many pending jobs ({pending_jobs_count} pending, limit is {config.config.PENDING_JOBS_LIMIT})"
        )

    job = db.mongo.jobs.find_one({"name": job_name})
    if job:
        raise HTTPException(
            status_code=400,
            detail=f"Job with the same plan file already exists: {job_name}"
        )

    files.create_file(file_content,file_name)
    
    job = models.Job(
        name=job_name,
        owner=current_user.username,
        description=description,
        status="pending",
        created_at=datetime.now()
    )

    try:
        result = db.mongo.jobs.insert_one(job.dict())
    except Exception as e:
        print(e)
        files.delete_file(file_name)

    return get_job(current_user, str(result.inserted_id))

def approve_job(current_user, job_id: str, approved: bool):
    job = get_job(current_user, job_id).dict()

    if job["status"] != "pending":
        raise HTTPException(status_code=400, detail="Cannot update job in current state")

    if approved:
        namespace = config.config.K8S_NAMESPACE
        file_name = f"{job['name']}.jmx"
        job_template_path = os.path.join(os.path.dirname(__file__), "../job.yaml.j2")

        file_content = files.read_file(file_name)

        configmap = client.V1ConfigMap(
            metadata=client.V1ObjectMeta(name=job["name"], labels={"job-id": job["id"]}),
            data={"plan.jmx": file_content}
        )

        with open(job_template_path, 'r') as file:
            job_template_content = file.read()

        rendered_job = Template(job_template_content).render(
            name=job["name"],
            namespace=namespace,
            job_id=job["id"],
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
        label_selector = f"job-id={job['id']}"

        # Delete the Job(s) based on the label selector
        jobs = client.BatchV1Api().list_namespaced_job(
            namespace=config.config.K8S_NAMESPACE,
            label_selector=label_selector
        )
        
        for job_item in jobs.items:
            job_name = job_item.metadata.name
            client.BatchV1Api().delete_namespaced_job(
                namespace=config.config.K8S_NAMESPACE,
                name=job_name,
                propagation_policy='Foreground'
            )
            print(f"Job {job_name} deleted")

        # Delete the ConfigMap(s) based on the label selector
        config_maps = client.CoreV1Api().list_namespaced_config_map(
            namespace=config.config.K8S_NAMESPACE,
            label_selector=label_selector
        )

        for cm in config_maps.items:
            cm_name = cm.metadata.name
            client.CoreV1Api().delete_namespaced_config_map(
                namespace=config.config.K8S_NAMESPACE,
                name=cm_name
            )
            print(f"ConfigMap {cm_name} deleted")

        # Delete Pods based on the label selector
        pods = client.CoreV1Api().list_namespaced_pod(
            namespace=config.config.K8S_NAMESPACE,
            label_selector=label_selector
        )
        
        for pod in pods.items:
            pod_name = pod.metadata.name
            print(f"Deleting Pod: {pod_name}")
            client.CoreV1Api().delete_namespaced_pod(
                name=pod_name,
                namespace=config.config.K8S_NAMESPACE,
                body=client.V1DeleteOptions(),
                grace_period_seconds=0
            )
    except Exception as e:
        print(e)

    files.delete_file(f"{job['name']}.jmx")
        
    db.mongo.jobs.delete_one({"_id": bson.objectid.ObjectId(job_id)})
    
    return {f"Job {job['name']} deleted"}