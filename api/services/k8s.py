from kubernetes import client, config as k8s_config
from api.config import config
from api.services import files
from jinja2 import Template
from fastapi import HTTPException
import yaml
import os
import logging

k8s_config.load_incluster_config()

def get_current_namespace():
    try:
        with open("/var/run/secrets/kubernetes.io/serviceaccount/namespace", "r") as f:
            return f.read().strip()
    except FileNotFoundError:
        return "Namespace file not found"

current_namespace = get_current_namespace()

def gen_labels(job_id):
    return {"jrunner/job-id": job_id}

def gen_label_selector(job_id):
    return f"jrunner/job-id={job_id}"

def stream_pod_logs(job_id, job_status):
    try:
        label_selector = gen_label_selector(job_id)

        logging.info(f"Looking for Pods with label selector: {label_selector}")
        pod_list = client.CoreV1Api().list_namespaced_pod(
            namespace=current_namespace,
            label_selector=label_selector
        )

        if not pod_list.items:
            logging.warning(f"No Pods found for Job: {job_id}")
            yield "data: No pods found for this job.\n\n"
            return
        
        pod_name = pod_list.items[0].metadata.name
        logging.info(f"Streaming logs from pod: {pod_name}")

        # Don't follow logs for completed or failed jobs
        should_follow = job_status == 'running'

        logs = client.CoreV1Api().read_namespaced_pod_log(
            name=pod_name,
            namespace=current_namespace,
            follow=should_follow,
            _preload_content=False,  # Don't preload content for better streaming
            tail_lines=1000 if not should_follow else None  # Limit lines for completed jobs
        )

        for line in logs:
            if isinstance(line, bytes):
                line = line.decode('utf-8')
            yield f"data: {line}\n\n"  # SSE format

    except client.exceptions.ApiException as e:
        logging.error(f"Kubernetes API error: {e}")
        yield f"data: Error: {e.reason}\n\n"
        return

def schedule_workload(job_id):
    k8s_object_name = f"jrunner-{job_id}"
    k8s_object_labels = gen_labels(job_id)
    k8s_object_namespace = current_namespace
    file_name = f"{job_id}/plan.jmx"
    job_template_path = os.path.join(os.path.dirname(__file__), "../job/job.yaml.j2")

    file_content = files.read_file(file_name)

    configmap = client.V1ConfigMap(
        metadata=client.V1ObjectMeta(name=k8s_object_name, labels=k8s_object_labels),
        data={"plan.jmx": file_content}
    )

    with open(job_template_path, 'r') as file:
        job_template_content = file.read()

    rendered_job = Template(job_template_content).render(
        name=k8s_object_name,
        namespace=k8s_object_namespace,
        labels = k8s_object_labels,
        nodeSelector=config.K8S_JOB_NODE_SELECTOR,
        tolerations=config.K8S_JOB_TOLERATIONS,
        job_image=config.K8S_JOB_IMAGE,
        job_id=job_id,
        s3_url=config.S3_URL,
        s3_access_key=config.S3_ACCESS_KEY,
        s3_secret_key=config.S3_SECRET_KEY,
        s3_bucket=config.S3_BUCKET
    )

    job_manifest = yaml.safe_load(rendered_job)

    try:
        # Create ConfigMap
        client.CoreV1Api().create_namespaced_config_map(namespace=k8s_object_namespace, body=configmap)
        logging.info(f"Created Kubernetes ConfigMap: {job_id}")

        # Create Job
        client.BatchV1Api().create_namespaced_job(namespace=k8s_object_namespace, body=job_manifest)
        logging.info(f"Created Kubernetes Job: {job_id}")

    except Exception as e:
        logging.error(f"Failed to create workload {job_id}: {e}")
        raise HTTPException(status_code=500, detail="Error creating workload")
    
def delete_workload(job_id):
  try:
      label_selector = gen_label_selector(job_id)

      logging.info(f"Deleting Workload with label selector: {label_selector}")
      jobs = client.BatchV1Api().list_namespaced_job(
          namespace=current_namespace,
          label_selector=label_selector
      )
      
      logging.info(f"Found {len(jobs.items)} Jobs to delete")
      for job_item in jobs.items:
          job_name = job_item.metadata.name
          client.BatchV1Api().delete_namespaced_job(
              namespace=current_namespace,
              name=job_name,
              propagation_policy='Foreground'
          )
          logging.info(f"Job {job_name} deleted")

      logging.info(f"Deleting ConfigMaps with label selector: {label_selector}")
      config_maps = client.CoreV1Api().list_namespaced_config_map(
          namespace=current_namespace,
          label_selector=label_selector
      )

      logging.info(f"Found {len(config_maps.items)} ConfigMaps to delete")
      for cm in config_maps.items:
          cm_name = cm.metadata.name
          client.CoreV1Api().delete_namespaced_config_map(
              namespace=current_namespace,
              name=cm_name
          )
          logging.info(f"ConfigMap {cm_name} deleted")

      logging.info(f"Deleting Pods with label selector: {label_selector}")
      pods = client.CoreV1Api().list_namespaced_pod(
          namespace=current_namespace,
          label_selector=label_selector
      )
      
      logging.info(f"Found {len(pods.items)} Pods to delete")
      for pod in pods.items:
          pod_name = pod.metadata.name
          logging.info(f"Deleting Pod: {pod_name}")
          client.CoreV1Api().delete_namespaced_pod(
              name=pod_name,
              namespace=current_namespace,
              body=client.V1DeleteOptions(),
              grace_period_seconds=0
          )
  except Exception as e:
      logging.error(f"Failed to delete workload {job_id}: {e}")
      raise HTTPException(status_code=500, detail="Error deleting workload")