import codecs
import hashlib
import math
import os
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import cast

import yaml
from config import config
from core.log import logger
from fastapi import HTTPException
from jinja2 import Template
from kubernetes import client, stream
from kubernetes.client.rest import ApiException
from urllib3.exceptions import ReadTimeoutError

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

class PodLogsUnavailableError(RuntimeError):
    pass


@dataclass(frozen=True)
class KubernetesRecord:
    source_id: str
    ts: datetime
    msg: str


def _iter_log_lines(response):
    buffer = ""
    decoder = codecs.getincrementaldecoder("utf-8")(errors="replace")
    try:
        for chunk in response:
            buffer += decoder.decode(chunk, final=False) if isinstance(chunk, bytes) else str(chunk)
            while "\n" in buffer:
                line, buffer = buffer.split("\n", 1)
                yield line.removesuffix("\r")
        buffer += decoder.decode(b"", final=True)
        if buffer:
            yield buffer.removesuffix("\r")
    except ReadTimeoutError as error:
        raise PodLogsUnavailableError("Pod log stream read timed out") from error
    finally:
        close = getattr(response, "close", None)
        if callable(close):
            close()


def _parse_log_timestamp(value: str) -> datetime:
    try:
        timestamp = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return timestamp if timestamp.tzinfo else timestamp.replace(tzinfo=timezone.utc)
    except ValueError:
        return datetime.now(timezone.utc)


def iter_pod_log_records(
    job_id: str,
    *,
    follow: bool,
    since_time: datetime | None = None,
):
    """Capture the jmeter container's stdout/stderr, stripping only Kubernetes timestamps."""
    namespace = get_namespace()
    label_selector = gen_label_selector(job_id, "master")
    core_v1 = client.CoreV1Api()
    pod_list = core_v1.list_namespaced_pod(
        namespace=namespace,
        label_selector=label_selector,
    )
    if not pod_list.items:
        raise PodLogsUnavailableError(f"No master pod found for job {job_id}")

    pod = pod_list.items[0]
    pod_name = pod.metadata.name
    pod_uid = str(pod.metadata.uid)
    options = {
        "name": pod_name,
        "namespace": namespace,
        "container": "jmeter",
        "follow": follow,
        "timestamps": True,
        "_preload_content": False,
        "_request_timeout": (5, 10 if follow else 30),
    }
    if since_time is not None:
        normalized = since_time if since_time.tzinfo else since_time.replace(tzinfo=timezone.utc)
        elapsed_seconds = (datetime.now(timezone.utc) - normalized).total_seconds()
        # Include one second of overlap; source_id upserts remove repeated lines.
        options["since_seconds"] = max(1, math.ceil(elapsed_seconds) + 1)

    try:
        response = core_v1.read_namespaced_pod_log(**options)
    except ApiException as error:
        if getattr(error, "status", None) in (400, 404, 409):
            raise PodLogsUnavailableError(f"Pod logs are not ready for job {job_id}") from error
        raise

    for line_number, line in enumerate(_iter_log_lines(response)):
        source_timestamp, separator, message = line.partition(" ")
        if not separator:
            source_timestamp = f"untimestamped:{line_number}"
            message = line
        source = f"{pod_uid}\0{source_timestamp}\0{message}".encode()
        yield KubernetesRecord(
            source_id=hashlib.sha256(source).hexdigest(),
            ts=_parse_log_timestamp(source_timestamp),
            msg=message,
        )


def iter_pod_log_lines(job_id, job_status):
    """Compatibility wrapper for callers that only need log messages."""
    for record in iter_pod_log_records(job_id, follow=job_status == "running"):
        yield record.msg


def _kubernetes_event_timestamp(event) -> datetime:
    series = getattr(event, "series", None)
    for value in (
        getattr(event, "event_time", None),
        getattr(series, "last_observed_time", None),
        getattr(event, "last_timestamp", None),
        getattr(event, "first_timestamp", None),
        getattr(getattr(event, "metadata", None), "creation_timestamp", None),
    ):
        if isinstance(value, datetime):
            return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc)


def _kubernetes_event_record(event) -> KubernetesRecord:
    metadata = getattr(event, "metadata", None)
    involved = getattr(event, "involved_object", None)
    series = getattr(event, "series", None)
    count = getattr(series, "count", None) or getattr(event, "count", None) or 1
    reason = getattr(event, "reason", None) or "Unknown"
    event_type = getattr(event, "type", None) or "Normal"
    kind = getattr(involved, "kind", None) or "Object"
    name = getattr(involved, "name", None) or "unknown"
    message = getattr(event, "message", None) or reason
    event_uid = getattr(metadata, "uid", None)
    if not event_uid:
        identity = f"{getattr(involved, 'uid', '')}\0{reason}\0{message}".encode()
        event_uid = hashlib.sha256(identity).hexdigest()
    return KubernetesRecord(
        source_id=f"kubernetes:{event_uid}:{count}",
        ts=_kubernetes_event_timestamp(event),
        msg=f"Kubernetes {kind} {name} [{event_type}/{reason}]: {message}",
    )


def list_job_events(job_id: str, workload) -> list[KubernetesRecord]:
    """List Kubernetes Events whose involved object is this Kubernetes Job."""
    workload_uid = getattr(getattr(workload, "metadata", None), "uid", None)
    if not workload_uid:
        return []

    try:
        response = client.CoreV1Api().list_namespaced_event(
            namespace=get_namespace(),
            field_selector=f"involvedObject.uid={workload_uid}",
        )
        return [_kubernetes_event_record(event) for event in response.items]
    except Exception as error:  # noqa: BLE001
        logger.warning(f"Failed to list Kubernetes Job events for {job_id}: {error}")
        return []


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
        
        pods = client.CoreV1Api().list_namespaced_pod(
            namespace=namespace,
            label_selector=label_selector
        )
        
        if not pods.items:
            logger.warning(f"No pods found for job {job_id}")
            raise HTTPException(status_code=404, detail="No running pods found for this job")
        
        pod = pods.items[0]
        pod_name = pod.metadata.name
        
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