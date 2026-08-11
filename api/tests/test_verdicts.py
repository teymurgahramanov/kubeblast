import io
import tempfile
import unittest
from pathlib import Path

from services.verdicts import (
    JMeterResultError,
    evaluate_jmeter_result,
    parse_jmeter_csv,
)


class ParseJMeterCsvTests(unittest.TestCase):
    def test_passes_when_all_samples_succeed(self):
        result = parse_jmeter_csv(
            io.StringIO("timeStamp,elapsed,label,success\n1,10,home,true\n2,12,api,TRUE\n"),
        )

        self.assertEqual(result.verdict, "passed")
        self.assertEqual(result.samples_total, 2)
        self.assertEqual(result.samples_failed, 0)
        self.assertEqual(result.error_rate, 0.0)
        self.assertIsNone(result.reason)

    def test_fails_and_calculates_error_rate_from_false_samples(self):
        result = parse_jmeter_csv(
            io.StringIO(
                "timeStamp,success,label\n"
                "1,false,home\n"
                "2,true,api\n"
                "3, FALSE ,checkout\n",
            ),
        )

        self.assertEqual(result.verdict, "failed")
        self.assertEqual(result.samples_total, 3)
        self.assertEqual(result.samples_failed, 2)
        self.assertAlmostEqual(result.error_rate, 2 / 3)

    def test_rejects_csv_without_success_column(self):
        with self.assertRaisesRegex(JMeterResultError, "missing the 'success' column"):
            parse_jmeter_csv(io.StringIO("timeStamp,label\n1,home\n"))

    def test_rejects_invalid_success_value(self):
        with self.assertRaisesRegex(JMeterResultError, "invalid success value"):
            parse_jmeter_csv(io.StringIO("timeStamp,success\n1,yes\n"))


class EvaluateJMeterResultTests(unittest.TestCase):
    def test_missing_file_is_not_evaluated(self):
        result = evaluate_jmeter_result(Path("/path/that/does/not/exist/result.jtl"))

        self.assertEqual(result.verdict, "not_evaluated")
        self.assertEqual(result.samples_total, 0)
        self.assertEqual(result.samples_failed, 0)
        self.assertEqual(result.error_rate, 0.0)
        self.assertEqual(result.reason, "Result file is missing.")

    def test_empty_file_is_not_evaluated(self):
        with tempfile.TemporaryDirectory() as directory:
            result_path = Path(directory) / "result.jtl"
            result_path.write_text("", encoding="utf-8")

            result = evaluate_jmeter_result(result_path)

        self.assertEqual(result.verdict, "not_evaluated")
        self.assertEqual(result.reason, "Result file is empty.")

    def test_malformed_csv_is_not_evaluated(self):
        with tempfile.TemporaryDirectory() as directory:
            result_path = Path(directory) / "result.jtl"
            result_path.write_text('timeStamp,success\n1,"false\n', encoding="utf-8")

            result = evaluate_jmeter_result(result_path)

        self.assertEqual(result.verdict, "not_evaluated")
        self.assertEqual(result.reason, "Result CSV is unparseable.")


if __name__ == "__main__":
    unittest.main()
