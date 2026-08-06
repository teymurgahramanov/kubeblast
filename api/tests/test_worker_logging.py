import sys
import types
import unittest
from unittest.mock import patch

sys.modules.setdefault("services.users", types.ModuleType("services.users"))

import worker

JOB_ID = "507f1f77bcf86cd799439011"


class WorkerLoggingTests(unittest.TestCase):
    def test_terminal_workload_is_deleted_only_after_final_log_capture(self):
        calls = []
        with (
            patch.object(
                worker.logs,
                "finalize_log_capture",
                side_effect=lambda *_: calls.append("logs") or True,
            ),
            patch.object(
                worker.k8s_service,
                "delete_workload",
                side_effect=lambda *_: calls.append("delete"),
            ),
        ):
            worker._cleanup_workload(JOB_ID, "completed")

        self.assertEqual(calls, ["logs", "delete"])

    def test_cleanup_is_deferred_when_final_log_capture_fails(self):
        with (
            patch.object(worker.logs, "finalize_log_capture", return_value=False),
            patch.object(worker.k8s_service, "delete_workload") as delete,
        ):
            worker._cleanup_workload(JOB_ID, "failed")

        delete.assert_not_called()


if __name__ == "__main__":
    unittest.main()
