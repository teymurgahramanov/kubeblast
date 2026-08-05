import sys
import types
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

# The local source tree receives this module from the Advanced overlay at build time.
sys.modules.setdefault("services.users", types.ModuleType("services.users"))

from fastapi import HTTPException
from services import jobs

JOB_ID = "507f1f77bcf86cd799439011"


class JobLifecycleTests(unittest.TestCase):
    def setUp(self):
        self.current_user = SimpleNamespace(username="alice", role="user")
        self.collection = Mock()
        self.collection.update_one.return_value = SimpleNamespace(matched_count=1)

        self.patchers = [
            patch.object(jobs, "get_job"),
            patch.object(jobs.db, "mongo", SimpleNamespace(jobs=self.collection)),
            patch.object(jobs.k8s, "schedule_workload"),
            patch.object(jobs.k8s, "delete_workload"),
            patch.object(jobs.k8s, "stop_workload"),
            patch.object(jobs.events, "create_event"),
            patch.object(jobs.logs, "delete_logs_for_job"),
            patch.object(jobs, "sleep"),
        ]
        self.mocks = [patcher.start() for patcher in self.patchers]
        self.addCleanup(self._stop_patchers)

        self.get_job = self.mocks[0]
        self.schedule_workload = self.mocks[2]
        self.delete_workload = self.mocks[3]
        self.stop_workload = self.mocks[4]
        self.delete_logs = self.mocks[6]

    def _stop_patchers(self):
        for patcher in reversed(self.patchers):
            patcher.stop()

    def set_job(self, status: str):
        job = {
            "id": JOB_ID,
            "name": "abc123",
            "owner": "alice",
            "distributed": False,
            "parameter_files": ["users.csv"],
            "status": status,
        }
        self.get_job.return_value = SimpleNamespace(
            status=status,
            model_dump=lambda: job,
        )

    def reject_transition(self, current_status: str):
        self.collection.update_one.return_value = SimpleNamespace(matched_count=0)
        self.collection.find_one.return_value = {"status": current_status}

    def test_start_accepts_ready_job(self):
        self.set_job("ready")

        response = jobs.start_job(self.current_user, JOB_ID)

        self.assertEqual(response.status, "starting")
        self.schedule_workload.assert_called_once_with(JOB_ID, False, ["users.csv"])
        self.collection.update_one.assert_called_once_with(
            {"_id": jobs.ObjectId(JOB_ID), "status": {"$in": ["ready"]}},
            {"$set": {"status": "starting"}},
        )

    def test_start_rejects_invalid_or_concurrent_transition(self):
        self.set_job("ready")
        self.reject_transition("running")

        with self.assertRaises(HTTPException) as raised:
            jobs.start_job(self.current_user, JOB_ID)

        self.assertEqual(raised.exception.status_code, 409)
        self.schedule_workload.assert_not_called()

    def test_start_failure_marks_transition_failed(self):
        self.set_job("ready")
        self.schedule_workload.side_effect = RuntimeError("scheduler unavailable")

        with self.assertRaises(HTTPException) as raised:
            jobs.start_job(self.current_user, JOB_ID)

        self.assertEqual(raised.exception.status_code, 500)
        self.assertEqual(self.collection.update_one.call_count, 2)
        self.assertEqual(
            self.collection.update_one.call_args_list[1].args,
            (
                {"_id": jobs.ObjectId(JOB_ID), "status": "starting"},
                {"$set": {"status": "failed"}},
            ),
        )

    def test_stop_leaves_completion_to_worker(self):
        self.set_job("running")

        response = jobs.stop_job(self.current_user, JOB_ID)

        self.assertEqual(response.status, "stopping")
        self.stop_workload.assert_called_once_with(JOB_ID)
        self.collection.update_one.assert_called_once_with(
            {"_id": jobs.ObjectId(JOB_ID), "status": {"$in": ["running"]}},
            {"$set": {"status": "stopping"}},
        )

    def test_retry_rejects_non_terminal_job(self):
        self.set_job("running")
        self.reject_transition("running")

        with self.assertRaises(HTTPException) as raised:
            jobs.retry_job(self.current_user, JOB_ID)

        self.assertEqual(raised.exception.status_code, 409)
        self.schedule_workload.assert_not_called()
        self.delete_workload.assert_not_called()
        self.delete_logs.assert_not_called()


if __name__ == "__main__":
    unittest.main()
