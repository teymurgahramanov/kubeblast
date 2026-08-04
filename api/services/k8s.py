import os
import time
from typing import cast

import yaml
from config import config
from core.log import logger
from fastapi import HTTPException
from jinja2 import Template
from kubernetes import client, stream
from kubernetes.client.rest import ApiException
from services import events
from services import files_fs as files


def get_namespace():
    try:
        with open("/var/run/secrets/kubernetes.io/serviceaccount/namespace", "r") as f:
            return f.read().strip()
    except FileNotFoundError:
        return "Namespace file not found"

def gen_resource_name(job_id):
    return f"kb-{job_id}" 

def gen_slave_resource_name(job_id):
    return f"kb-{job_id}-slave"

def gen_slave_service_name(job_id):
    return f"kb-{job_id}-slave"

def gen_labels(job_id,job_component):
    return {"kubeblast/job-id": job_id, "kubeblast/job-component": job_component}

def gen_label_selector(job_id,job_component):
    return f"kubeblast/job-id={job_id},kubeblast/job-component={job_component}"

def iter_pod_log_lines(job_id, job_status):
    """
    Yield raw log lines from the job's master pod (blocking iterator).
    Used by the log pump to persist lines to MongoDB; clients consume via logs.stream_job_logs.
    """
    namespace = get_namespace()
    label_selector = gen_label_selector(job_id, "master")
    try:
        logger.info(f"Looking for Pods with label selector: {label_selector}")
        pod_list = client.CoreV1Api().list_namespaced_pod(
            namespace=namespace,
            label_selector=label_selector
        )

        if not pod_list.items:
            logger.warning(f"Nothing found for Job: {job_id}")
            return

        pod_name = pod_list.items[0].metadata.name
        logger.info(f"Reading logs from pod: {pod_name}")

        should_follow = job_status == "running"

        logs = client.CoreV1Api().read_namespaced_pod_log(
            name=pod_name,
            namespace=namespace,
            container="jmeter",
            follow=should_follow,
            _preload_content=False,
            tail_lines=1000 if not should_follow else None,
        )

        for line in logs:
            if isinstance(line, bytes):
                line = line.decode("utf-8")
            yield line.rstrip("\n")

    except Exception as e:  # noqa: BLE001
        logger.error(e)
        yield "Waiting for logs ..."

def schedule_slave_daemonset_and_service(job_id: str):
    """
    Create (if missing) the slave headless Service and slave DaemonSet.
    Intentionally minimal: no updates/patching if they already exist.
    """
    namespace = get_namespace()
    labels = gen_labels(job_id, "slave")

    svc_name = gen_slave_service_name(job_id)
    ds_name = gen_slave_resource_name(job_id)

    v1 = client.CoreV1Api()
    apps = client.AppsV1Api()

    # Headless Service (create; ignore AlreadyExists)
    try:
        svc = client.V1Service(
            metadata=client.V1ObjectMeta(name=svc_name, labels=labels),
            spec=client.V1ServiceSpec(
                cluster_ip="None",
                selector=labels,
                ports=[
                    client.V1ServicePort(name="rmi", port=50000, target_port=50000, protocol="TCP"),
                ],
            ),
        )
        v1.create_namespaced_service(namespace=namespace, body=svc)
        logger.info(f"Created slave headless Service: {svc_name}")
    except ApiException as e:
        if getattr(e, "status", None) == 409:
            logger.info(f"Slave headless Service already exists: {svc_name}")
        else:
            msg = f"Failed to create slave Service {svc_name}. Handling: abort distributed scheduling."
            logger.error(f"{msg} Error: {e}")
            raise HTTPException(status_code=500, detail=f"{msg} Error: {e}")
    except Exception as e:  # noqa: BLE001
        msg = f"Failed to create slave Service {svc_name}. Handling: abort distributed scheduling."
        logger.error(f"{msg} Error: {e}")
        raise HTTPException(status_code=500, detail=f"{msg} Error: {e}")

    # DaemonSet
    try:
        ds_template_path = os.path.join(os.path.dirname(__file__), "../templates/ds.yaml.j2")
        with open(ds_template_path, "r") as file:
            ds_template_content = file.read()

        rendered_ds = Template(ds_template_content).render(
            name=ds_name,
            namespace=namespace,
            labels=labels,
            job_id=job_id,
            priority_class=config.K8S_JOB_PRIORITY_CLASS,
            image_job=config.K8S_JOB_IMAGE,
            image_pull_policy=config.K8S_JOB_IMAGE_PULL_POLICY,
            image_pull_secrets=config.K8S_JOB_IMAGE_PULL_SECRETS,
            nodeSelector=config.K8S_JOB_NODE_SELECTOR,
            tolerations=config.K8S_JOB_TOLERATIONS,
            resources=config.K8S_JOB_RESOURCES,
            storage_pvc_name=config.STORAGE_PVC_NAME,
        )
        ds_manifest = yaml.safe_load(rendered_ds)
        apps.create_namespaced_daemon_set(namespace=namespace, body=ds_manifest)
        logger.info(f"Created slave DaemonSet: {ds_name}")
    except ApiException as e:
        if getattr(e, "status", None) == 409:
            logger.info(f"Slave DaemonSet already exists: {ds_name}")
        else:
            msg = f"Failed to create slave DaemonSet {ds_name}. Handling: abort distributed scheduling."
            logger.error(f"{msg} Error: {e}")
            raise HTTPException(status_code=500, detail=f"{msg} Error: {e}")
    except Exception as e:  # noqa: BLE001
        msg = f"Failed to create slave DaemonSet {ds_name}. Handling: abort distributed scheduling."
        logger.error(f"{msg} Error: {e}")
        raise HTTPException(status_code=500, detail=f"{msg} Error: {e}")

def watch_daemonset_and_get_slave_endpoints(job_id: str, timeout_s: int = 180, poll_s: int = 2) -> list[str]:
    """
    Watch slave DaemonSet until fully ready, then return headless Service endpoints
    formatted for JMeter `-R` (ip:port).
    """
    namespace = get_namespace()
    svc_name = gen_slave_service_name(job_id)
    ds_name = gen_slave_resource_name(job_id)

    apps = client.AppsV1Api()
    v1 = client.CoreV1Api()

    start = time.time()
    last_desired = 0
    last_ready = 0
    while time.time() - start < timeout_s:
        ds = cast(
            client.V1DaemonSet,
            apps.read_namespaced_daemon_set(name=ds_name, namespace=namespace),
        )
        st = ds.status
        last_desired = int(getattr(st, "desired_number_scheduled", 0) or 0)
        last_ready = int(getattr(st, "number_ready", 0) or 0)

        if last_desired > 0 and last_ready >= last_desired:
            # DS is ready; fetch endpoints
            try:
                eps = cast(
                    client.V1Endpoints,
                    v1.read_namespaced_endpoints(name=svc_name, namespace=namespace),
                )
            except ApiException as e:
                if e.status == 404:
                    time.sleep(poll_s)
                    continue
                raise

            ips: list[str] = []
            if eps.subsets:
                for subset in eps.subsets:
                    if subset.addresses:
                        for addr in subset.addresses:
                            if addr and addr.ip:
                                ips.append(addr.ip)

            ips = sorted(set(ips))
            if ips:
                return [f"{ip}:50000" for ip in ips]

        time.sleep(poll_s)

    raise HTTPException(
        status_code=504,
        detail=f"Timed out waiting for slaves (ds_ready={last_ready}/{last_desired}, endpoints=empty)"
    )

def schedule_workload(job_id, distributed, parameter_files):
    name = gen_resource_name(job_id)
    namespace = get_namespace()
    labels = gen_labels(job_id,"master")
    file_name = "plan.jmx"
    file_content = files.read_file(job_id, file_name)

    from services.jmx import resolve_csv_parameter_files
    file_content = resolve_csv_parameter_files(file_content, job_id, parameter_files)

    if config.INFLUXDB_ENABLED:
        from services.jmx import inject_backend_listener
        file_content = inject_backend_listener(file_content, job_id)

    slaves=[]

    job_template_path = os.path.join(os.path.dirname(__file__), "../templates/job.yaml.j2")

    try:
        configmap_manifest = client.V1ConfigMap(
            metadata=client.V1ObjectMeta(name=name, labels=labels),
            data={"plan.jmx": file_content}
        )

        client.CoreV1Api().create_namespaced_config_map(namespace=namespace, body=configmap_manifest)
        logger.info(f"Created ConfigMap for job {job_id}")
        
        if distributed:
            try:
                schedule_slave_daemonset_and_service(job_id)
                slaves = watch_daemonset_and_get_slave_endpoints(job_id)
            except Exception as e:
                logger.error(f"Failed to create distributed slaves for job {job_id}: {e}")
                events.create_event(job_id, f"Failed to create distributed slaves: {e}")
                delete_workload(job_id)
                raise

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
            resources=config.K8S_JOB_RESOURCES_MASTER if distributed else config.K8S_JOB_RESOURCES,
            storage_pvc_name=config.STORAGE_PVC_NAME
        )

        job_manifest = yaml.safe_load(rendered_job)
        client.BatchV1Api().create_namespaced_job(namespace=namespace, body=job_manifest)
        logger.info(f"Created Kubernetes Job: {job_id}")

    except Exception as e:  # noqa: BLE001
        logger.error(f"Failed to create workload {job_id}: {e}")
        delete_workload(job_id)
        raise HTTPException(status_code=500, detail=f"Error creating workload: {e!s}")
    
def stop_workload(job_id):
    """Gracefully stop a running workload by executing shutdown.sh in the pod"""
    namespace = get_namespace()
    label_selector = gen_label_selector(job_id, "master")
    
    try:
        logger.info(f"Gracefully stopping workload with label selector: {label_selector}")
        
        # Get pod
        pods = client.CoreV1Api().list_namespaced_pod(
            namespace=namespace,
            label_selector=label_selector
        )
        
        if not pods.items:
            logger.warning(f"No pods found for job {job_id}")
            raise HTTPException(status_code=404, detail="No running pods found for this job")
        
        pod = pods.items[0]
        pod_name = pod.metadata.name
        
        # Execute shutdown.sh in the pod
        try:
            logger.info(f"Executing shutdown.sh in pod {pod_name}")
            exec_command = ['/bin/sh', '-c', 'shutdown.sh']
            
            resp = stream.stream(
                client.CoreV1Api().connect_get_namespaced_pod_exec,
                pod_name,
                namespace,
                container='jmeter',
                command=exec_command,
                stderr=True,
                stdin=False,
                stdout=True,
                tty=False,
                _preload_content=False
            )
            
            # Read response
            output = ""
            while resp.is_open():
                resp.update(timeout=1)
                if resp.peek_stdout():
                    output += resp.read_stdout()
                if resp.peek_stderr():
                    output += resp.read_stderr()
            
            resp.close()
            
            logger.info(f"Shutdown command executed successfully in pod {pod_name}")
            logger.info(f"Output: {output}")
            logger.info("JMeter will shutdown gracefully and Kubernetes will clean up the Job automatically")
            
        except Exception as e:  # noqa: BLE001
            logger.error(f"Failed to execute shutdown command in pod: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to execute shutdown command: {e!s}")
        
        logger.info(f"Workload {job_id} shutdown initiated")
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
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

        logger.info(f"Deleting Services with label selector: {label_selector}")
        services = client.CoreV1Api().list_namespaced_service(
            namespace=namespace,
            label_selector=label_selector
        )
        logger.info(f"Found {len(services.items)} Services to delete")
        for svc in services.items:
            svc_name = svc.metadata.name
            try:
                client.CoreV1Api().delete_namespaced_service(namespace=namespace, name=svc_name)
                logger.info(f"Service {svc_name} deleted")
            except Exception as e:  # noqa: BLE001
                logger.warning(f"Failed to delete Service {svc_name}: {e}")
    except Exception as e:  # noqa: BLE001
        logger.error(f"Failed to delete workload {job_id}: {e}")
        raise HTTPException(status_code=500, detail="Error deleting workload")