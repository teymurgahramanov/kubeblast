import os
import yaml
from jinja2 import Template
from kubernetes import client, config

config.load_incluster_config()
namespace = "default"

def create_job(job_name,file_name,file_content):

  metadata = client.V1ObjectMeta(name=job_name, namespace=namespace)

  client.CoreV1Api().create_namespaced_config_map(
    metadata=metadata,
    body=client.V1ConfigMap(data={file_name: file_content.decode("utf-8")})
  )

  # Generate Job
  job_template_path = os.path.join(os.path.dirname(__file__), "../job.yaml.j2")
  with open(job_template_path, 'r') as file:
      job_template_content = file.read()
  rendered_job = Template(job_template_content).render(
      name=job_name,
      namespace=namespace,
      file_name=file_name
  )
  job_manifest = yaml.safe_load(rendered_job)
  job = client.BatchV1Api().create_namespaced_job(
      body=job_manifest
  )
  return {"job": {job.metadata.name}}