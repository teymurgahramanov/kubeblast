import os
import time

import bson
from config import config
from core.log import logger
from kubernetes import client, watch
from pymongo import MongoClient, UpdateOne
from services import k8s as k8s_service

# MongoDB Configuration
MONGODB_URI = config.MONGODB_URI
DB_NAME = config.MONGODB_NAME
COLLECTION_NAME = "jobs"
FULL_RESYNC_INTERVAL_S = int(getattr(config, "WORKER_WATCH_INTERVAL", 300))
WATCH_TIMEOUT_S = int(getattr(config, "WORKER_WATCH_TIMEOUT", 60))
JOB_LABEL_SELECTOR = "kubeblast/job-id"

def get_current_namespace():
    try:
        with open("/var/run/secrets/kubernetes.io/serviceaccount/namespace", "r") as f:
            return f.read().strip()
    except FileNotFoundError:
        return os.getenv("KUBEBLAST_NAMESPACE", "default")

current_namespace = get_current_namespace()

mongo_client = MongoClient(MONGODB_URI)
db = mongo_client[DB_NAME]
jobs_collection = db[COLLECTION_NAME]

def determine_job_status(job) -> str:
    status = getattr(job, "status", None)
    if status is None:
        return "unknown"
    
    active = (getattr(status, "active", 0) or 0)
    succeeded = (getattr(status, "succeeded", 0) or 0)
    failed = (getattr(status, "failed", 0) or 0)
    conditions = getattr(status, "conditions", None) or []
    
    # Prefer terminal conditions first
    for cond in conditions:
        if getattr(cond, "type", None) == "Failed" and getattr(cond, "status", None) == "True":
            return "failed"
    for cond in conditions:
        if getattr(cond, "type", None) == "Complete" and getattr(cond, "status", None) == "True":
            return "completed"
    
    # Suspended jobs are not terminal; surface as 'starting' for UI continuity
    for cond in conditions:
        if getattr(cond, "type", None) == "Suspended" and getattr(cond, "status", None) == "True":
            return "starting"
    
    # Live counters as fallback
    if active > 0:
        return "running"
    if succeeded > 0:
        return "completed"
    if failed > 0:
        return "failed"
    
    # Job exists but nothing has started yet
    return "starting"

def _safe_object_id(job_id: str):
    try:
        return bson.ObjectId(job_id)
    except Exception:
        return None

def _extract_job_id(job) -> str | None:
    md = getattr(job, "metadata", None)
    if not md:
        return None
    labels = getattr(md, "labels", None) or {}
    return labels.get("kubeblast/job-id")

def _bulk_update_statuses(pairs: list[tuple[str, str]]):
    ops = []
    for job_id, status in pairs:
        oid = _safe_object_id(job_id)
        if not oid:
            logger.warning(f"Skipping Mongo update due to invalid job id: {job_id}")
            continue
        query: dict = {"_id": oid}
        if status in ("starting", "running"):
            # Do not let a stale active observation undo an accepted stop or
            # regress a job that MongoDB already records as terminal.
            query["status"] = {"$nin": ["stopping", "completed", "failed"]}
        ops.append(
            UpdateOne(
                query,
                {"$set": {"status": status}},
            )
        )
    if not ops:
        return
    try:
        jobs_collection.bulk_write(ops, ordered=False)
    except Exception as e:
        logger.error(f"Bulk Mongo update failed: {e}")

def _cleanup_workload(job_id: str, status: str):
    if status not in ("completed", "failed"):
        return
    try:
        k8s_service.delete_workload(job_id)
        logger.info(f"Triggered workload cleanup for terminal job {job_id} (status={status})")
    except Exception as e:
        # Best-effort cleanup; don't crash the worker
        logger.warning(f"Workload cleanup failed for job {job_id} (status={status}): {e}")

def full_resync(batch_v1: client.BatchV1Api) -> str | None:
    """
    Full reconciliation pass:
    - Lists only Kubeblast jobs (label_selector)
    - Bulk-writes computed statuses to MongoDB
    Returns the list's resourceVersion for watch resumption.
    """
    resp = batch_v1.list_namespaced_job(namespace=current_namespace, label_selector=JOB_LABEL_SELECTOR)
    jobs = getattr(resp, "items", None) or []
    if not jobs:
        logger.debug("Full resync: no Kubeblast jobs found.")
    else:
        updates: list[tuple[str, str]] = []
        terminal: list[tuple[str, str]] = []
        for job in jobs:
            job_id = _extract_job_id(job)
            if not job_id:
                continue
            status = determine_job_status(job)
            if status == "unknown":
                continue
            updates.append((job_id, status))
            if status in ("completed", "failed"):
                terminal.append((job_id, status))
        _bulk_update_statuses(updates)
        logger.info(f"Full resync: reconciled {len(updates)} jobs")
        # After restart / missed events: ensure terminal jobs get cleaned up too
        for job_id, status in terminal:
            _cleanup_workload(job_id, status)

    md = getattr(resp, "metadata", None)
    return getattr(md, "resource_version", None)

def process_job_update():
    """
    Efficient status sync:
    - Primary: Kubernetes watch stream for Jobs with `kubeblast/job-id` label (event-driven)
    - Safety net: periodic full resync to recover from restarts/missed watch events
    """
    batch_v1 = client.BatchV1Api()
    logger.info(
        f"Starting worker (namespace={current_namespace}, label_selector={JOB_LABEL_SELECTOR}, "
        f"full_resync_interval_s={FULL_RESYNC_INTERVAL_S}, watch_timeout_s={WATCH_TIMEOUT_S})"
    )

    # Ensure convergence after restart
    resource_version = None
    last_resync = 0.0
    backoff_s = 1.0

    while True:
        now = time.time()
        if (now - last_resync) >= FULL_RESYNC_INTERVAL_S or resource_version is None:
            try:
                resource_version = full_resync(batch_v1) or resource_version
                last_resync = time.time()
            except Exception as e:
                logger.error(f"Full resync failed: {e}")
                time.sleep(min(backoff_s, 30))
                backoff_s = min(backoff_s * 2, 30)
                continue

        w = watch.Watch()
        try:
            for event in w.stream(
                batch_v1.list_namespaced_job,
                namespace=current_namespace,
                label_selector=JOB_LABEL_SELECTOR,
                resource_version=resource_version,
                timeout_seconds=WATCH_TIMEOUT_S,
            ):
                obj = event.get("object")
                if not obj:
                    continue

                md = getattr(obj, "metadata", None)
                if md and getattr(md, "resource_version", None):
                    resource_version = md.resource_version

                job_id = _extract_job_id(obj)
                if not job_id:
                    continue

                status = determine_job_status(obj)
                if status == "unknown":
                    continue

                _bulk_update_statuses([(job_id, status)])
                _cleanup_workload(job_id, status)

            # If the watch timed out naturally, loop and continue; keeps resync cadence
            backoff_s = 1.0

        except client.exceptions.ApiException as e:
            # 410 Gone: resourceVersion too old -> relist
            if getattr(e, "status", None) == 410:
                logger.warning("Watch resourceVersion too old (410). Forcing full resync.")
                resource_version = None
                continue
            logger.error(f"Kubernetes API error in watch loop: {e}")
        except Exception as e:
            logger.error(f"Unexpected error in watch loop: {e}")
        finally:
            try:
                w.stop()
            except Exception:
                pass

        time.sleep(min(backoff_s, 30))
        backoff_s = min(backoff_s * 2, 30)

if __name__ == "__main__":
    process_job_update()