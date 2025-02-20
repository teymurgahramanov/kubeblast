from kubernetes import client, config as k8s_config
from api.core import config
from api.services import files
from jinja2 import Template
from fastapi import HTTPException
import yaml
import os
import logging

k8s_config.load_incluster_config()

def gen_labels(job_id):
    return {"jrunnerJobId": job_id}

def stream_pod_logs(job_id):
    namespace = config.config.K8S_NAMESPACE

    try:
        label_selector = gen_labels(job_id)

        pod_list = client.CoreV1Api().list_namespaced_pod(
            namespace=namespace,
            label_selector=label_selector
        )

        if not pod_list.items:
            print(f"No Pods found for Job: {job_id}")
            yield "data: No pods found for this job.\n\n"
            return
        
        pod_name = pod_list.items[0].metadata.name
        print(f"Streaming logs from pod: {pod_name}")

        logs =client.CoreV1Api().read_namespaced_pod_log(
            name=pod_name,
            namespace=namespace,
            follow=True,
            _preload_content=False,
        )

        for line in logs.stream():
            yield f"data: {line.decode('utf-8')}\n\n"  # SSE format

    except client.exceptions.ApiException as e:
        yield f"data: Error: {e.reason}\n\n"
        return

def schedule_workload(job_id):
    k8s_object_name = f"jrunner-{job_id}"
    k8s_object_labels = gen_labels(job_id)
    k8s_object_namespace = config.config.K8S_NAMESPACE
    k8s_configmap_key = "plan.jmx"
    file_name = f"{job_id}.jmx"
    job_template_path = os.path.join(os.path.dirname(__file__), "../job.yaml.j2")

    file_content = files.read_file(file_name)

    configmap = client.V1ConfigMap(
        metadata=client.V1ObjectMeta(name=k8s_object_name, labels=k8s_object_labels),
        data={k8s_configmap_key: file_content}
    )

    with open(job_template_path, 'r') as file:
        job_template_content = file.read()

    rendered_job = Template(job_template_content).render(
        name=k8s_object_name,
        namespace=k8s_object_namespace,
        labels = k8s_object_labels,
        configmap_key=k8s_configmap_key,
        nodeSelector=config.config.K8S_NODE_SELECTOR,
        tolerations=config.config.K8S_TOLERATIONS,
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
      label_selector = gen_labels(job_id)

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