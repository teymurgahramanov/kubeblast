import os
import yaml
from jinja2 import Template
from kubernetes import client, config as k8s_config
from app.config import config

k8s_config.load_incluster_config()
namespace = config.K8S_NAMESPACE
configmap_key = config.K8S_CONFIGMAP_KEY

def list_workloads():
    jobs = client.BatchV1Api().list_namespaced_job(namespace=namespace)
    return {"jobs": [job.metadata.name for job in jobs.items]}

def create_workload(job_name,cm_key,cm_data):

    configmap = client.V1ConfigMap(
        metadata=client.V1ObjectMeta(name=job_name),
        data={cm_key: cm_data.decode("utf-8")}
    )

    client.CoreV1Api().create_namespaced_config_map(namespace=namespace, body=configmap)
    print(f"ConfigMap created in namespace: {namespace}")

    # Generate Job
    job_template_path = os.path.join(os.path.dirname(__file__), "./job.yaml.j2")
    with open(job_template_path, 'r') as file:
        job_template_content = file.read()
    rendered_job = Template(job_template_content).render(
        name=job_name,
        namespace=namespace,
        cm_key=cm_key
    )
    job_manifest = yaml.safe_load(rendered_job)
    job = client.BatchV1Api().create_namespaced_job(
        namespace=namespace,
        body=job_manifest
    )
    return {"job": {job.metadata.name}}

def delete_workload(job_name):

  try:
      client.BatchV1Api().delete_namespaced_job(
          namespace=namespace,
          name = job_name,
          propagation_policy = 'Foreground'
      )
      print(f"Job {job_name} deleted")
  except Exception as e:
      print(e)
      pass
  
  try: 
      client.CoreV1Api().delete_namespaced_config_map(
          namespace=namespace,
          name = job_name
      )
      print(f"ConfigMap {job_name} deleted")
  except Exception as e:
      print(e)
      pass

  try:
    label_selector = f"batch.kubernetes.io/job-name={job_name}"
    print(f"Finding Pods with label: {label_selector}")
    pods = client.CoreV1Api().list_namespaced_pod(namespace=namespace, label_selector=label_selector)

    for pod in pods.items:
        print(f"Deleting Pod: {pod.metadata.name}")
        client.CoreV1Api().delete_namespaced_pod(
            name = pod.metadata.name,
            namespace = namespace,
            body = client.V1DeleteOptions(),
            grace_period_seconds = 0
        )
  except Exception as e:
      print(e)
      pass
  
  return {"Workload": "deleted"}