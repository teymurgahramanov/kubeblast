import sys
import threading
import types
import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import Mock, patch

sys.modules.setdefault("services.users", types.ModuleType("services.users"))

from services import k8s, logs

JOB_ID = "507f1f77bcf86cd799439011"
RECORD = k8s.KubernetesRecord(
    source_id="source-id",
    ts=datetime(2026, 1, 2, 3, 4, 5, tzinfo=timezone.utc),
    msg="hello",
)


class LogReliabilityTests(unittest.TestCase):
    def tearDown(self):
        with logs._pump_lock:
            for state in logs._pumps.values():
                state.stop_event.set()
            logs._pumps.clear()

    def test_source_id_insert_is_idempotent(self):
        collection = Mock()
        collection.update_one.return_value = SimpleNamespace(upserted_id=None)
        with patch.object(logs.db, "mongo", SimpleNamespace(job_logs=collection)):
            inserted = logs.append_log_line(
                JOB_ID,
                "hello",
                RECORD.ts,
                source_id=RECORD.source_id,
            )

        self.assertFalse(inserted)
        collection.update_one.assert_called_once()
        self.assertEqual(
            collection.update_one.call_args.args[0],
            {"source_id": RECORD.source_id},
        )

    def test_pump_retries_until_pod_exists_without_storing_placeholder(self):
        state = logs._PumpState(threading.Event())
        with logs._pump_lock:
            logs._pumps[JOB_ID] = state

        def persist(*_args):
            state.stop_event.set()

        with (
            patch.object(logs, "_job_is_active", return_value=True),
            patch.object(
                k8s,
                "iter_pod_log_records",
                side_effect=[k8s.PodLogsUnavailableError("not ready"), [RECORD]],
            ) as iterator,
            patch.object(logs, "_persist_record", side_effect=persist) as persist_record,
        ):
            logs._run_pump(JOB_ID, state)

        self.assertEqual(iterator.call_count, 2)
        persist_record.assert_called_once_with(JOB_ID, RECORD)

    def test_final_capture_reads_complete_non_following_log(self):
        with (
            patch.object(logs, "stop_log_pump") as stop,
            patch.object(k8s, "iter_pod_log_records", return_value=[RECORD]) as iterator,
            patch.object(logs, "_persist_record") as persist,
        ):
            completed = logs.finalize_log_capture(JOB_ID)

        self.assertTrue(completed)
        stop.assert_called_once_with(JOB_ID, wait=True)
        iterator.assert_called_once_with(JOB_ID, follow=False)
        persist.assert_called_once_with(JOB_ID, RECORD)

    def test_kubernetes_log_read_has_timestamps_and_no_tail_limit(self):
        pod = SimpleNamespace(metadata=SimpleNamespace(name="master", uid="pod-uid"))
        core = Mock()
        core.list_namespaced_pod.return_value = SimpleNamespace(items=[pod])
        core.read_namespaced_pod_log.return_value = [
            b'2026-01-02T03:04:05Z {"message":"arbitrary stdout"}\n'
        ]

        since_time = datetime.now(timezone.utc) - timedelta(seconds=5)
        with patch.object(k8s.client, "CoreV1Api", return_value=core):
            records = list(
                k8s.iter_pod_log_records(
                    JOB_ID,
                    follow=False,
                    since_time=since_time,
                )
            )

        self.assertEqual(records[0].msg, '{"message":"arbitrary stdout"}')
        options = core.read_namespaced_pod_log.call_args.kwargs
        self.assertTrue(options["timestamps"])
        self.assertFalse(options["follow"])
        self.assertEqual(options["container"], "jmeter")
        self.assertNotIn("tail_lines", options)
        self.assertNotIn("since_time", options)
        self.assertGreaterEqual(options["since_seconds"], 5)

    def test_kubernetes_decoder_preserves_split_utf8(self):
        encoded = "2026-01-02T03:04:05Z blast 🚀\n".encode()
        split = encoded.index(b"\xf0")

        self.assertEqual(
            list(k8s._iter_log_lines([encoded[: split + 1], encoded[split + 1 :]])),
            ["2026-01-02T03:04:05Z blast 🚀"],
        )


if __name__ == "__main__":
    unittest.main()
