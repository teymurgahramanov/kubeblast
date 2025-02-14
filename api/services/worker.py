import asyncio
import logging
import bson
from kubernetes_asyncio import client, watch
from motor.motor_asyncio import AsyncIOMotorClient

async def process_job_update():
    """Watches Kubernetes jobs and updates their status in MongoDB asynchronously."""
    batch_v1 = client.BatchV1Api()
    w = watch.Watch()
    logging.info("Starting Kubernetes Job Watcher...")

    while True:
        try:
            async with batch_v1.api_client as api_client:
                async for event in w.stream(batch_v1.list_namespaced_job, namespace=NAMESPACE):
                    job = event["object"]
                    job_id = job.metadata.labels.get("job_id")
                    if not job_id:
                        continue

                    # Determine job status
                    if job.status.active:
                        new_status = "running"
                    elif job.status.succeeded:
                        new_status = "completed"
                    elif job.status.failed:
                        new_status = "failed"
                    else:
                        continue  # Ignore other status changes

                    update_result = await jobs_collection.update_one(
                        {"_id": bson.ObjectId(job_id)},
                        {"$set": {"status": new_status}}
                    )

                    if update_result.matched_count > 0:
                        logging.info(f"Updated MongoDB: {job_id} -> status {new_status}")
                    else:
                        logging.warning(f"MongoDB update failed: {job_id} not found.")
        except client.exceptions.ApiException as e:
            logging.error(f"Kubernetes API error: {e}")
        except Exception as e:
            logging.error(f"Unexpected error in job update process: {e}")

        await asyncio.sleep(WATCH_INTERVAL)