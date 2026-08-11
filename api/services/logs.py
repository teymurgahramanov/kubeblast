import json
import threading
import time
from dataclasses import dataclass
from datetime import datetime, timezone

import bson
from pymongo.errors import DuplicateKeyError

from core import db, models
from core.log import logger

_ACTIVE_STATUSES = frozenset({"starting", "retrying", "running", "stopping"})


@dataclass
class _PumpState:
    stop_event: threading.Event
    thread: threading.Thread | None = None
    since_time: datetime | None = None


_pumps: dict[str, _PumpState] = {}
_pump_lock = threading.Lock()
_capture_locks: dict[str, threading.RLock] = {}


def _capture_lock(job_id: str) -> threading.RLock:
    with _pump_lock:
        return _capture_locks.setdefault(job_id, threading.RLock())


def append_log_line(
    job_id: str,
    msg: str,
    ts: datetime | None = None,
    *,
    source_id: str | None = None,
) -> bool:
    """Persist one pod log line, idempotently when a Kubernetes source ID is available."""
    entry = models.JobLog(
        job_id=job_id,
        ts=ts or datetime.now(timezone.utc),
        msg=models.JobLog.coerce_msg(msg),
    )
    document = entry.model_dump()
    if source_id is None:
        db.mongo.job_logs.insert_one(document)
        return True

    document["source_id"] = source_id
    try:
        result = db.mongo.job_logs.update_one(
            {"source_id": source_id},
            {"$setOnInsert": document},
            upsert=True,
        )
        return result.upserted_id is not None
    except DuplicateKeyError:
        return False


def delete_logs_for_job(job_id: str) -> None:
    db.mongo.job_logs.delete_many({"job_id": job_id})


def _last_captured_time(job_id: str) -> datetime | None:
    try:
        document = db.mongo.job_logs.find_one(
            {"job_id": job_id},
            {"ts": 1},
            sort=[("ts", -1)],
        )
    except Exception as error:  # noqa: BLE001
        logger.warning(f"Could not load log cursor for job {job_id}: {error}")
        return None
    timestamp = document.get("ts") if document else None
    if not isinstance(timestamp, datetime):
        return None
    return timestamp if timestamp.tzinfo is not None else timestamp.replace(tzinfo=timezone.utc)


def _job_is_active(job_id: str) -> bool | None:
    try:
        document = db.mongo.jobs.find_one(
            {"_id": bson.ObjectId(job_id)},
            {"status": 1},
        )
    except Exception as error:  # noqa: BLE001
        logger.warning(f"Could not check log collector state for job {job_id}: {error}")
        return None
    return bool(document and document.get("status") in _ACTIVE_STATUSES)


def _is_current_pump(job_id: str, state: _PumpState) -> bool:
    with _pump_lock:
        return _pumps.get(job_id) is state and not state.stop_event.is_set()


def _persist_record(job_id: str, record) -> None:
    with _capture_lock(job_id):
        append_log_line(job_id, record.msg, record.ts, source_id=record.source_id)


def _run_pump(job_id: str, state: _PumpState) -> None:
    from services import k8s

    retry_delay_s = 1.0
    try:
        while _is_current_pump(job_id, state):
            active = _job_is_active(job_id)
            if active is False:
                return
            if active is None:
                if state.stop_event.wait(retry_delay_s):
                    return
                retry_delay_s = min(retry_delay_s * 2, 10.0)
                continue

            try:
                for record in k8s.iter_pod_log_records(
                    job_id,
                    follow=True,
                    since_time=state.since_time,
                ):
                    if not _is_current_pump(job_id, state):
                        return
                    _persist_record(job_id, record)
                    state.since_time = record.ts
                    retry_delay_s = 1.0
            except k8s.PodLogsUnavailableError as error:
                logger.debug(f"Pod logs are not available for job {job_id}; retrying: {error}")
            except Exception as error:  # noqa: BLE001
                logger.warning(f"Log collection failed for job {job_id}; retrying: {error}")

            if state.stop_event.wait(retry_delay_s):
                return
            retry_delay_s = min(retry_delay_s * 2, 10.0)
    finally:
        with _pump_lock:
            if _pumps.get(job_id) is state:
                _pumps.pop(job_id, None)


def ensure_log_pump(job_id: str, job_status: str) -> None:
    """Ensure the single API replica is collecting logs for an active job."""
    if job_status not in _ACTIVE_STATUSES:
        return

    with _pump_lock:
        current = _pumps.get(job_id)
        if current and current.thread and current.thread.is_alive():
            return
        if current:
            current.stop_event.set()

        state = _PumpState(
            stop_event=threading.Event(),
            since_time=_last_captured_time(job_id),
        )
        state.thread = threading.Thread(
            target=_run_pump,
            args=(job_id, state),
            daemon=True,
            name=f"log-pump-{job_id}",
        )
        _pumps[job_id] = state
        state.thread.start()


def stop_log_pump(job_id: str, *, wait: bool = True, timeout_s: float = 15.0) -> None:
    """Stop a collector and wait until it cannot append another line."""
    state: _PumpState | None = None
    with _pump_lock:
        state = _pumps.pop(job_id, None)
        if state:
            state.stop_event.set()

    if wait and state and state.thread and state.thread is not threading.current_thread():
        state.thread.join(timeout_s)
        if state.thread.is_alive():
            logger.warning(f"Timed out waiting for log collector to stop for job {job_id}")

    if wait:
        with _capture_lock(job_id):
            pass


def finalize_log_capture(
    job_id: str,
    *,
    max_attempts: int = 5,
    retry_interval_s: float = 1.0,
) -> bool:
    """Persist a complete final pod-log snapshot before terminal workload cleanup."""
    from services import k8s

    stop_log_pump(job_id, wait=True)
    with _capture_lock(job_id):
        for capture_attempt in range(1, max_attempts + 1):
            try:
                for record in k8s.iter_pod_log_records(job_id, follow=False):
                    _persist_record(job_id, record)
                return True
            except Exception as error:  # noqa: BLE001
                logger.warning(
                    f"Final log capture attempt {capture_attempt}/{max_attempts} failed "
                    f"for job {job_id}: {error}"
                )
                if capture_attempt < max_attempts:
                    time.sleep(retry_interval_s)
        return False


def stream_job_logs(
    job_id: str,
    *,
    poll_interval_s: float = 1.0,
    heartbeat_s: float = 15.0,
):
    """
    Stream job log lines as Server-Sent Events by polling MongoDB.

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
            cursor = db.mongo.job_logs.find(query).sort("_id", 1).limit(200)
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
