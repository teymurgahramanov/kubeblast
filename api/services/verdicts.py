import csv
import typing
from dataclasses import dataclass
from pathlib import Path

Verdict = typing.Literal["passed", "failed", "not_evaluated"]


@dataclass(frozen=True)
class VerdictEvaluation:
    verdict: Verdict
    samples_total: int = 0
    samples_failed: int = 0
    error_rate: float = 0.0
    reason: str | None = None


class JMeterResultError(ValueError):
    """Raised when a JMeter result CSV cannot be evaluated reliably."""


def parse_jmeter_csv(csv_file: typing.TextIO) -> VerdictEvaluation:
    """Evaluate an open JMeter CSV stream without database or filesystem access."""
    reader = csv.DictReader(csv_file, strict=True)
    fieldnames = reader.fieldnames
    if not fieldnames:
        raise JMeterResultError("Result file is empty.")

    success_column = next(
        (
            fieldname
            for fieldname in fieldnames
            if fieldname and fieldname.strip().lower() == "success"
        ),
        None,
    )
    if success_column is None:
        raise JMeterResultError("Result CSV is missing the 'success' column.")

    samples_total = 0
    samples_failed = 0
    try:
        for row_number, row in enumerate(reader, start=2):
            if None in row:
                raise JMeterResultError(
                    f"Result CSV has unexpected columns at row {row_number}.",
                )

            success = row.get(success_column)
            if success is None or success.strip().lower() not in {"true", "false"}:
                raise JMeterResultError(
                    f"Result CSV has an invalid success value at row {row_number}.",
                )

            samples_total += 1
            if success.strip().lower() == "false":
                samples_failed += 1
    except csv.Error as exc:
        raise JMeterResultError("Result CSV is unparseable.") from exc

    if samples_total == 0:
        raise JMeterResultError("Result CSV contains no samples.")

    return VerdictEvaluation(
        verdict="failed" if samples_failed else "passed",
        samples_total=samples_total,
        samples_failed=samples_failed,
        error_rate=samples_failed / samples_total,
    )


def evaluate_jmeter_result(result_path: Path) -> VerdictEvaluation:
    """Read and evaluate a JMeter result file, returning a non-throwing verdict."""
    try:
        with result_path.open("r", encoding="utf-8-sig", newline="") as csv_file:
            return parse_jmeter_csv(csv_file)
    except FileNotFoundError:
        return VerdictEvaluation(
            verdict="not_evaluated",
            reason="Result file is missing.",
        )
    except JMeterResultError as exc:
        return VerdictEvaluation(
            verdict="not_evaluated",
            reason=str(exc),
        )
    except (OSError, UnicodeError, csv.Error):
        return VerdictEvaluation(
            verdict="not_evaluated",
            reason="Result file could not be parsed.",
        )
