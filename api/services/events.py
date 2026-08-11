import json
import time
from datetime import datetime

import bson

from core import db
from core import models


def create_event(job_id: str, msg: str, ts: datetime | None = None) -> None:
    """
    Best-effort insert of a job event document.
    """
    if not ts:
        ts = datetime.utcnow()
    entry = models.JobLog(job_id=job_id, ts=ts, msg=models.JobLog.coerce_msg(msg))
    db.mongo.events.insert_one(entry.model_dump())


def create_kubernetes_event(job_id: str, event) -> None:
    """Insert one Kubernetes Event once, including updates to its occurrence count."""
    entry = models.JobLog(
        job_id=job_id,
        ts=event.ts,
        msg=models.JobLog.coerce_msg(event.msg),
    )
    document = entry.model_dump()
    document["kubernetes_event_id"] = event.source_id
    db.mongo.events.update_one(
        {"job_id": job_id, "kubernetes_event_id": event.source_id},
        {"$setOnInsert": document},
        upsert=True,
    )


def delete_events_for_job(job_id: str) -> None:
    db.mongo.events.delete_many({"job_id": job_id})


def stream_job_events(
    job_id: str,
    *,
    poll_interval_s: float = 1.0,
    heartbeat_s: float = 15.0,
):
    """
    Stream job events as Server-Sent Events by polling MongoDB.

    SSE payload is JSON in `data:` lines:
      {"job_id": "...", "ts": "...", "msg": "..."}
    """
    last_id: bson.ObjectId | None = None
    last_heartbeat = time.monotonic()

    while True:
        # If job is deleted, end the stream.
        try:
            if db.mongo.jobs.count_documents({"_id": bson.ObjectId(job_id)}) == 0:
                yield "event: end\ndata: job deleted\n\n"
                return
        except Exception:
            # Invalid ObjectId or transient Mongo error; just keep streaming.
            pass

        query: dict = {"job_id": job_id}
        if last_id is not None:
            query["_id"] = {"$gt": last_id}

        try:
            cursor = (
                db.mongo.events
                .find(query)
                .sort("_id", 1)
                .limit(200)
            )
            sent_any = False
            for doc in cursor:
                last_id = doc.get("_id", last_id)
                row = models.JobLog.from_mongo_doc(doc, fallback_job_id=job_id)
                payload = row.model_dump(mode="json")
                yield f"data: {json.dumps(payload)}\n\n"
                sent_any = True

            if not sent_any and (time.monotonic() - last_heartbeat) >= heartbeat_s:
                # Comment ping to keep intermediaries from timing out the connection.
                yield ": ping\n\n"
                last_heartbeat = time.monotonic()

        except Exception:
            # Keep stream alive on transient DB issues.
            yield "data: Waiting for events ...\n\n"

        time.sleep(poll_interval_s)


