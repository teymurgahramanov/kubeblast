from core import k8s
from kubernetes import client
from config import config
from jinja2 import Template
from fastapi import HTTPException
import yaml
import os
from core.log import logger

from services import files_fs as files

def get_namespace():
    try:
        with open("/var/run/secrets/kubernetes.io/serviceaccount/namespace", "r") as f:
            return f.read().strip()
    except FileNotFoundError:
        return "Namespace file not found"

def gen_resource_name(job_id):
    return f"kb-{job_id}" 

def gen_labels(job_id,job_component):
    return {"kubeblast/job-id": job_id, "kubeblast/job-component": job_component}

def gen_label_selector(job_id,job_component):
    return f"kubeblast/job-id={job_id},kubeblast/job-component={job_component}"

def stream_pod_logs(job_id, job_status):
    namespace = get_namespace()
    label_selector = gen_label_selector(job_id,"master")
    try:
        logger.info(f"Looking for Pods with label selector: {label_selector}")
        pod_list = client.CoreV1Api().list_namespaced_pod(
            namespace=namespace,
            label_selector=label_selector
        )

        if not pod_list.items:
            logger.warning(f"No Pods found for Job: {job_id}")
            yield "data: No pods found for this job.\n\n"
            return
        
        pod_name = pod_list.items[0].metadata.name
        logger.info(f"Streaming logs from pod: {pod_name}")

        # Don't follow logs for completed or failed jobs
        should_follow = job_status == 'running'

        logs = client.CoreV1Api().read_namespaced_pod_log(
            name=pod_name,
            namespace=namespace,
            container="jmeter",
            follow=should_follow,
            _preload_content=False,
            tail_lines=1000 if not should_follow else None
        )

        for line in logs:
            if isinstance(line, bytes):
                line = line.decode('utf-8')
            yield f"data: {line}\n\n"  # SSE format

    except Exception as e:
        logger.error(e)
        yield f"data: Waiting for logs ...\n\n"
        return

def schedule_workload(job_id,distributed):
    name = gen_resource_name(job_id)
    namespace = get_namespace()
    labels = gen_labels(job_id,"master")
    file_name = "plan.jmx"
    file_content = files.read_file(job_id, file_name)
    slaves=[]

    job_template_path = os.path.join(os.path.dirname(__file__), "../templates/job.yaml.j2")

    try:
        configmap_manifest = client.V1ConfigMap(
            metadata=client.V1ObjectMeta(name=name, labels=labels),
            data={"plan.jmx": file_content}
        )

        client.CoreV1Api().create_namespaced_config_map(namespace=namespace, body=configmap_manifest)
        logger.info(f"Created ConfigMap for job {job_id}")
        
        #if config.IS_PRO and distributed:
        #    try:
        #        from services import k8s_extra
        #         slaves = k8s_extra.create_slaves(job_id)
        #    except Exception as e:
        #        logger.error(f"Failed to create slaves for job {job_id}: {e}")
        #        delete_workload(job_id)
        #        raise HTTPException(status_code=500, detail=f"Error creating slaves: {str(e)}")

        # Create Job
        with open(job_template_path, 'r') as file:
            job_template_content = file.read()

        rendered_job = Template(job_template_content).render(
            name=name,
            namespace=namespace,
            labels = labels,
            job_id=job_id,
            priority_class=config.K8S_JOB_PRIORITY_CLASS,
            image_job=config.K8S_JOB_IMAGE,
            image_pull_policy=config.K8S_JOB_IMAGE_PULL_POLICY,
            image_pull_secrets=config.K8S_JOB_IMAGE_PULL_SECRETS,
            slaves=slaves,
            nodeSelector=config.K8S_JOB_NODE_SELECTOR,
            tolerations=config.K8S_JOB_TOLERATIONS,
            resources=config.K8S_JOB_RESOURCES,
            storage_pvc_name=config.STORAGE_PVC_NAME
        )

        job_manifest = yaml.safe_load(rendered_job)
        client.BatchV1Api().create_namespaced_job(namespace=namespace, body=job_manifest)
        logger.info(f"Created Kubernetes Job: {job_id}")

    except Exception as e:
        logger.error(f"Failed to create workload {job_id}: {e}")
        delete_workload(job_id)
        raise HTTPException(status_code=500, detail=f"Error creating workload: {str(e)}")
    
def stop_workload(job_id):
    """Gracefully stop a running workload by deleting the Job with grace period"""
    namespace = get_namespace()
    label_selector = f"kubeblast/job-id={job_id}"
    try:
        logger.info(f"Gracefully stopping workload with label selector: {label_selector}")
        
        # Delete Job with grace period to allow JMeter to finish and save reports
        jobs = client.BatchV1Api().list_namespaced_job(
            namespace=namespace,
            label_selector=label_selector
        )
        
        logger.info(f"Found {len(jobs.items)} Jobs to stop gracefully")
        for job_item in jobs.items:
            job_name = job_item.metadata.name
            logger.info(f"Stopping Job: {job_name}")
            client.BatchV1Api().delete_namespaced_job(
                name=job_name,
                namespace=namespace,
                body=client.V1DeleteOptions(
                    propagation_policy='Foreground',
                    grace_period_seconds=60  # Give JMeter 60 seconds to finish
                )
            )
        
        logger.info(f"Workload {job_id} stopped gracefully")
    except Exception as e:
        logger.error(f"Failed to stop workload {job_id}: {e}")
        raise HTTPException(status_code=500, detail="Error stopping workload")

def delete_workload(job_id):
    namespace = get_namespace()
    label_selector = f"kubeblast/job-id={job_id}"
    try:
        logger.info(f"Deleting Workload with label selector: {label_selector}")

        jobs = client.BatchV1Api().list_namespaced_job(
            namespace=namespace,
            label_selector=label_selector
        )
        
        logger.info(f"Found {len(jobs.items)} Jobs to delete")
        for job_item in jobs.items:
            job_name = job_item.metadata.name
            client.BatchV1Api().delete_namespaced_job(
                namespace=namespace,
                name=job_name,
                propagation_policy='Foreground',
                grace_period_seconds = 0
            )
            logger.info(f"Job {job_name} deleted")

        logger.info(f"Deleting DaemonSet with label selector: {label_selector}")
        daemonset = client.AppsV1Api().list_namespaced_daemon_set(
            namespace=namespace,
            label_selector=label_selector
        )
        
        logger.info(f"Found {len(daemonset.items)} DaemonSets to delete")  
        for ds in daemonset.items:
            ds_name = ds.metadata.name
            client.AppsV1Api().delete_namespaced_daemon_set(
                namespace=namespace,
                name=ds_name
            )
            logger.info(f"DaemonSet {ds_name} deleted")

        logger.info(f"Deleting ConfigMaps with label selector: {label_selector}")
        config_maps = client.CoreV1Api().list_namespaced_config_map(
            namespace=namespace,
            label_selector=label_selector
        )

        logger.info(f"Found {len(config_maps.items)} ConfigMaps to delete")
        for cm in config_maps.items:
            cm_name = cm.metadata.name
            client.CoreV1Api().delete_namespaced_config_map(
                namespace=namespace,
                name=cm_name
            )
            logger.info(f"ConfigMap {cm_name} deleted")

        logger.info(f"Deleting Pods with label selector: {label_selector}")
        pods = client.CoreV1Api().list_namespaced_pod(
            namespace=namespace,
            label_selector=label_selector
        )
        
        logger.info(f"Found {len(pods.items)} Pods to delete")
        for pod in pods.items:
            pod_name = pod.metadata.name
            logger.info(f"Deleting Pod: {pod_name}")
            client.CoreV1Api().delete_namespaced_pod(
                name=pod_name,
                namespace=namespace,
                body=client.V1DeleteOptions(),
                grace_period_seconds=0
            )
    except Exception as e:
        logger.error(f"Failed to delete workload {job_id}: {e}")
        raise HTTPException(status_code=500, detail="Error deleting workload")