import json
import threading
import time
from datetime import datetime

import bson

from core import db
from core import models
from core.log import logger

_pump_threads: dict[str, threading.Thread] = {}
_pump_lock = threading.Lock()


def append_log_line(job_id: str, msg: str, ts: datetime | None = None) -> None:
    """Best-effort insert of a log line document (JobLog shape)."""
    if not ts:
        ts = datetime.utcnow()
    entry = models.JobLog(job_id=job_id, ts=ts, msg=models.JobLog.coerce_msg(msg))
    db.mongo.job_logs.insert_one(entry.model_dump())


def delete_logs_for_job(job_id: str) -> None:
    db.mongo.job_logs.delete_many({"job_id": job_id})


def _run_pump(job_id: str, job_status: str) -> None:
    try:
        from services import k8s

        for line in k8s.iter_pod_log_lines(job_id, job_status):
            append_log_line(job_id, line)
    except Exception as e:
        logger.error(f"Log pump failed for job {job_id}: {e}")
        try:
            append_log_line(job_id, f"[log pump error] {e}")
        except Exception:
            pass
    finally:
        with _pump_lock:
            _pump_threads.pop(job_id, None)


def ensure_log_pump(job_id: str, job_status: str) -> None:
    """
    Start at most one Kubernetes log reader per job, writing lines into MongoDB.

    For non-running jobs, only runs if there are no stored lines yet (one-shot tail).
    For running jobs, (re)starts the pump if the previous thread finished.
    """
    try:
        if job_status != "running":
            if db.mongo.job_logs.count_documents({"job_id": job_id}) > 0:
                return
    except Exception:
        pass

    with _pump_lock:
        t = _pump_threads.get(job_id)
        if t is not None and t.is_alive():
            return
        thread = threading.Thread(
            target=_run_pump,
            args=(job_id, job_status),
            daemon=True,
            name=f"log-pump-{job_id}",
        )
        _pump_threads[job_id] = thread
        thread.start()


def stream_job_logs(
    job_id: str,
    *,
    poll_interval_s: float = 1.0,
    heartbeat_s: float = 15.0,
):
    """
    Stream job log lines as Server-Sent Events by polling MongoDB (same pattern as job events).

    SSE payload is JSON in `data:` lines:
      {"job_id": "...", "ts": "...", "msg": "..."}
    """
    last_id: bson.ObjectId | None = None
    last_heartbeat = time.monotonic()

    while True:
        try:
            if db.mongo.jobs.count_documents({"_id": bson.ObjectId(job_id)}) == 0:
                yield "event: end\ndata: job deleted\n\n"
                return
        except Exception:
            pass

        query: dict = {"job_id": job_id}
        if last_id is not None:
            query["_id"] = {"$gt": last_id}

        try:
            cursor = (
                db.mongo.job_logs.find(query).sort("_id", 1).limit(200)
            )
            sent_any = False
            for doc in cursor:
                last_id = doc.get("_id", last_id)
                row = models.JobLog.from_mongo_doc(doc, fallback_job_id=job_id)
                payload = row.model_dump(mode="json")
                yield f"data: {json.dumps(payload)}\n\n"
                sent_any = True

            if not sent_any and (time.monotonic() - last_heartbeat) >= heartbeat_s:
                yield ": ping\n\n"
                last_heartbeat = time.monotonic()

        except Exception:
            yield "data: Waiting for logs ...\n\n"

        time.sleep(poll_interval_s)
