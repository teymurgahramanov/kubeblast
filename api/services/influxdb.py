import logging

import httpx
from config import config
from core.log import logger

logging.getLogger("httpx").setLevel(logging.WARNING)

def _query(q: str) -> list:
    """
    Execute an InfluxQL query and return the series results.
    epoch=ms returns Unix milliseconds (UTC instants); GROUP BY time() aligns to UTC.
    """
    try:
        resp = httpx.get(
            f"{config.INFLUXDB_URL}/query",
            params={"db": config.INFLUXDB_DATABASE, "q": q, "epoch": "ms"},
            timeout=10.0,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        logger.warning(f"InfluxDB query failed: {e}")
        return []

    results = data.get("results", [])
    if not results:
        return []
    return results[0].get("series", [])


def _extract_time_series(series: list, value_keys: list[str]) -> dict:
    """
    Convert InfluxDB series response into {column_name: [values...], "timestamps": [...]}.
    """
    result = {"timestamps": []}
    for key in value_keys:
        result[key] = []

    if not series:
        return result

    columns = series[0].get("columns", [])
    values = series[0].get("values", [])

    col_indices = {}
    for key in value_keys:
        if key in columns:
            col_indices[key] = columns.index(key)

    time_idx = columns.index("time") if "time" in columns else None

    for row in values:
        if time_idx is not None:
            result["timestamps"].append(row[time_idx])
        for key, idx in col_indices.items():
            val = row[idx]
            result[key].append(val if val is not None else 0)

    return result


def delete_job_metrics(job_id: str):
    """Delete all InfluxDB measurements associated with a job."""
    if not config.INFLUXDB_ENABLED:
        return

    app_tag = f"kb-{job_id}"
    q = f"DELETE FROM \"jmeter\" WHERE \"application\" = '{app_tag}';"
    q += f" DELETE FROM \"events\" WHERE \"application\" = '{app_tag}'"
    try:
        resp = httpx.post(
            f"{config.INFLUXDB_URL}/query",
            params={"db": config.INFLUXDB_DATABASE, "q": q},
            timeout=10.0,
        )
        resp.raise_for_status()
        logger.info(f"Deleted InfluxDB metrics for job {job_id}")
    except Exception as e:
        logger.warning(f"Failed to delete InfluxDB metrics for job {job_id}: {e}")


def get_live_metrics(job_id: str) -> dict:
    """
    Query InfluxDB for real-time JMeter metrics for a specific job.
    Returns structured time-series data suitable for charting.
    All timestamp values are UTC epoch milliseconds; clients should convert for display
    using the configured application timezone (e.g. TIMEZONE /stats/app).
    """
    if not config.INFLUXDB_ENABLED:
        return {"enabled": False, "data": {}}

    app_filter = f"\"application\" = 'kb-{job_id}'"

    response_query = (
        f'SELECT mean("avg") AS "avg_response_time",'
        f' mean("pct90.0") AS "p90_response_time",'
        f' mean("pct95.0") AS "p95_response_time",'
        f' mean("pct99.0") AS "p99_response_time"'
        f' FROM "jmeter"'
        f' WHERE {app_filter} AND "statut" = \'all\''
        f' GROUP BY time(5s) fill(none)'
    )

    throughput_query = (
        f'SELECT sum("count") / 5 AS "throughput"'
        f' FROM "jmeter"'
        f' WHERE {app_filter} AND "statut" = \'all\''
        f' GROUP BY time(5s) fill(none)'
    )

    error_query = (
        f'SELECT sum("countError") AS "error_count"'
        f' FROM "jmeter"'
        f' WHERE {app_filter} AND "statut" = \'all\''
        f' GROUP BY time(5s) fill(none)'
    )

    threads_query = (
        f'SELECT last("meanAT") AS "active_threads"'
        f' FROM "jmeter"'
        f' WHERE {app_filter}'
        f' GROUP BY time(5s) fill(none)'
    )

    response_series = _query(response_query)
    throughput_series = _query(throughput_query)
    error_series = _query(error_query)
    threads_series = _query(threads_query)

    response_data = _extract_time_series(
        response_series,
        ["avg_response_time", "p90_response_time", "p95_response_time", "p99_response_time"],
    )
    throughput_data = _extract_time_series(throughput_series, ["throughput"])
    error_data = _extract_time_series(error_series, ["error_count"])
    threads_data = _extract_time_series(threads_series, ["active_threads"])

    return {
        "enabled": True,
        "timestamps_epoch_ms_utc": True,
        "data": {
            "timestamps": response_data["timestamps"],
            "avg_response_time": response_data["avg_response_time"],
            "p90_response_time": response_data["p90_response_time"],
            "p95_response_time": response_data["p95_response_time"],
            "p99_response_time": response_data["p99_response_time"],
            "throughput_timestamps": throughput_data["timestamps"],
            "throughput": throughput_data["throughput"],
            "error_timestamps": error_data["timestamps"],
            "error_count": error_data["error_count"],
            "threads_timestamps": threads_data["timestamps"],
            "active_threads": threads_data["active_threads"],
        },
    }
