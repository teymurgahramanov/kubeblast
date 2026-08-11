import sys
import types
import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import Mock, patch

sys.modules.setdefault("services.users", types.ModuleType("services.users"))

import worker
from services import events as event_service
from services import k8s

JOB_ID = "507f1f77bcf86cd799439011"


def kubernetes_event(uid, kind, name, reason, message, count=1):
    return SimpleNamespace(
        metadata=SimpleNamespace(uid=uid, creation_timestamp=datetime.now(timezone.utc)),
        involved_object=SimpleNamespace(uid=f"object-{uid}", kind=kind, name=name),
        series=None,
        count=count,
        event_time=None,
        last_timestamp=None,
        first_timestamp=None,
        type="Warning" if reason == "FailedScheduling" else "Normal",
        reason=reason,
        message=message,
    )


class KubernetesEventTests(unittest.TestCase):
    def test_lists_events_for_the_kubernetes_job_object(self):
        workload = SimpleNamespace(metadata=SimpleNamespace(uid="job-uid"))
        job_event = kubernetes_event(
            "event-job",
            "Job",
            "kb-job",
            "SuccessfulCreate",
            "Created pod",
            count=3,
        )
        core = Mock()
        core.list_namespaced_event.return_value = SimpleNamespace(items=[job_event])

        with patch.object(k8s.client, "CoreV1Api", return_value=core):
            records = k8s.list_job_events(JOB_ID, workload)

        self.assertEqual(len(records), 1)
        self.assertIn("Kubernetes Job kb-job", records[0].msg)
        self.assertEqual(records[0].source_id, "kubernetes:event-job:3")
        core.list_namespaced_event.assert_called_once_with(
            namespace=k8s.get_namespace(),
            field_selector="involvedObject.uid=job-uid",
        )

    def test_kubernetes_event_occurrence_is_stored_once(self):
        collection = Mock()
        mongo = SimpleNamespace(events=collection)
        record = k8s.KubernetesRecord(
            source_id="kubernetes:event-uid:2",
            ts=datetime.now(timezone.utc),
            msg="Kubernetes Pod pod [Warning/FailedScheduling]: Insufficient cpu",
        )

        with patch.object(event_service.db, "mongo", mongo):
            event_service.create_kubernetes_event(JOB_ID, record)

        collection.update_one.assert_called_once()
        query, update = collection.update_one.call_args.args
        self.assertEqual(
            query,
            {"job_id": JOB_ID, "kubernetes_event_id": record.source_id},
        )
        self.assertEqual(update["$setOnInsert"]["msg"], record.msg)
        self.assertTrue(collection.update_one.call_args.kwargs["upsert"])

    def test_worker_passes_collected_events_to_existing_event_store(self):
        workload = SimpleNamespace()
        record = k8s.KubernetesRecord(
            source_id="kubernetes:event-uid:1",
            ts=datetime.now(timezone.utc),
            msg="Kubernetes Job kb-job [Normal/SuccessfulCreate]: Created pod",
        )
        with (
            patch.object(worker.k8s_service, "list_job_events", return_value=[record]),
            patch.object(worker.events, "create_kubernetes_event") as create,
        ):
            worker._sync_kubernetes_events(JOB_ID, workload)

        create.assert_called_once_with(JOB_ID, record)


if __name__ == "__main__":
    unittest.main()
