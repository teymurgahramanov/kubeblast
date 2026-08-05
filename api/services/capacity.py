from datetime import datetime
from typing import Dict, List
import re

from kubernetes import client

from config import config
from core import k8s  # noqa: F401  (ensures in-cluster k8s client config is loaded)
from core import db, models
from core.log import logger


# ============================================================================
# CPU & MEMORY PARSING
# ============================================================================

_CPU_PATTERN = re.compile(r"^(\d+(\.\d+)?)(m|n|u)?$")
_MEM_PATTERN = re.compile(r"^(\d+(\.\d+)?)([KMGTPE]i?)?$")

_MEM_UNITS = {
    "Ki": 1024,
    "Mi": 1024**2,
    "Gi": 1024**3,
    "Ti": 1024**4,
    "Pi": 1024**5,
    "Ei": 1024**6,
    "K": 1000,
    "M": 1000**2,
    "G": 1000**3,
    "T": 1000**4,
    "P": 1000**5,
    "E": 1000**6,
}


def parse_cpu(cpu: str) -> int:
    """Parse CPU string to millicores."""
    if not cpu:
        return 0
    m = _CPU_PATTERN.match(cpu)
    if not m:
        return 0
    value, _, suffix = m.groups()
    if suffix == "n":
        return int(float(value) / 1_000_000)  # nanocores to millicores
    elif suffix == "u":
        return int(float(value) / 1_000)  # microcores to millicores
    elif suffix == "m":
        return int(float(value))  # already millicores
    else:
        return int(float(value) * 1000)  # cores to millicores


def parse_mem(mem: str) -> int:
    """Parse memory string to bytes."""
    if not mem:
        return 0
    m = _MEM_PATTERN.match(mem)
    if not m:
        return 0
    value, _, unit = m.groups()
    return int(float(value) * _MEM_UNITS.get(unit or "", 1))


# ============================================================================
# NODE FILTERING (availability + selector + tolerations)
# ============================================================================

def node_is_available(node: client.V1Node) -> bool:
    """Return True when a node can currently accept scheduled workloads."""
    if getattr(node.spec, "unschedulable", False):
        return False

    conditions = getattr(node.status, "conditions", []) or []
    ready = next((c for c in conditions if c.type == "Ready"), None)
    return bool(ready and ready.status == "True")


def node_matches(node: client.V1Node, selector: dict, tolerations: list) -> bool:
    labels = node.metadata.labels or {}

    # selector filter
    if selector and any(labels.get(k) != v for k, v in selector.items()):
        return False

    # taints vs tolerations
    taints = getattr(node.spec, "taints", []) or []
    for t in taints:
        if t.effect in ("NoSchedule", "NoExecute"):
            if not tolerations:
                return False
            tolerated = any(
                tol.get("key") == t.key and
                (tol.get("effect") in (None, t.effect)) and
                (tol.get("operator", "Equal") == "Exists" or tol.get("value") == t.value)
                for tol in tolerations
            )
            if not tolerated:
                return False

    return True


# ============================================================================
# METRICS API (metrics.k8s.io)
# ============================================================================


def _fetch_pods_usage_by_node(node_names: List[str]) -> Dict[str, int]:
    """
    Fetch pod metrics from the Kubernetes metrics API (metrics.k8s.io) and
    aggregate usage for pods running on the provided nodes.

    This requires RBAC permissions for apiGroup metrics.k8s.io on pods.
    Returns: {"cpu_m": total, "memory_bytes": total}
    """
    total_cpu = 0
    total_mem = 0
    
    if not node_names:
        return {"cpu_m": 0, "memory_bytes": 0}
    
    node_set = set(node_names)
    v1 = client.CoreV1Api()
    metrics = client.CustomObjectsApi()
    
    try:
        metrics_data = metrics.list_cluster_custom_object(
            group="metrics.k8s.io",
            version="v1beta1",
            plural="pods",
        )

        # Build a map of pod -> node from the k8s API
        pod_node_map: Dict[str, str] = {}
        token = None
        while True:
            resp = v1.list_pod_for_all_namespaces(
                limit=500,
                _continue=token,
                timeout_seconds=30,
            )
            for pod in resp.items or []:
                pod_key = f"{pod.metadata.namespace}/{pod.metadata.name}"
                node_name = pod.spec.node_name
                if node_name:
                    pod_node_map[pod_key] = node_name

            token = getattr(resp.metadata, "_continue", None) or getattr(resp.metadata, "continue", None)
            if not token:
                break

        # Aggregate metrics for pods on matching nodes
        for item in metrics_data.get("items", []):
            metadata = item.get("metadata", {})
            pod_key = f"{metadata.get('namespace', '')}/{metadata.get('name', '')}"
            node_name = pod_node_map.get(pod_key)

            if node_name and node_name in node_set:
                for container in item.get("containers", []):
                    usage = container.get("usage", {})
                    total_cpu += parse_cpu(usage.get("cpu", "0"))
                    total_mem += parse_mem(usage.get("memory", "0"))

    except Exception as e:
        # If metrics API is unavailable, return zeros (and log for diagnosis).
        logger.warning(f"Capacity metrics fetch failed (metrics.k8s.io): {e}")
    
    return {"cpu_m": total_cpu, "memory_bytes": total_mem}


def _pod_requested_resources(pod: client.V1Pod) -> Dict[str, int]:
    """
    Compute a pod's requested resources using scheduler semantics:
      - sum(requests of regular containers) + overhead
      - initContainers are not summed; instead take max(initContainer requests)
      - final pod request = max(sum(containers), max(initContainers)) + overhead

    Returns: {"cpu_m": int, "memory_bytes": int}
    """
    def _req(res, key: str) -> int:
        if not res:
            return 0
        reqs = getattr(res, "requests", None) or {}
        val = reqs.get(key)
        if not val:
            return 0
        if key == "cpu":
            return parse_cpu(val)
        if key == "memory":
            return parse_mem(val)
        return 0

    containers = (pod.spec.containers or []) if pod and pod.spec else []
    init_containers = (pod.spec.init_containers or []) if pod and pod.spec else []

    sum_cpu = sum(_req(c.resources, "cpu") for c in containers)
    sum_mem = sum(_req(c.resources, "memory") for c in containers)

    max_init_cpu = 0
    max_init_mem = 0
    for c in init_containers:
        max_init_cpu = max(max_init_cpu, _req(c.resources, "cpu"))
        max_init_mem = max(max_init_mem, _req(c.resources, "memory"))

    pod_cpu = max(sum_cpu, max_init_cpu)
    pod_mem = max(sum_mem, max_init_mem)

    # pod overhead (if set) is added on top
    overhead = getattr(pod.spec, "overhead", None) or {}
    if overhead:
        pod_cpu += parse_cpu(overhead.get("cpu", "0"))
        pod_mem += parse_mem(overhead.get("memory", "0"))

    return {"cpu_m": pod_cpu, "memory_bytes": pod_mem}


def _fetch_pods_requests_by_node(node_names: List[str]) -> Dict[str, int]:
    """
    Sum requested resources for pods scheduled to the provided nodes.

    This matches what the Kubernetes scheduler uses for "Insufficient cpu/memory":
    it compares a node's allocatable resources against already requested resources.
    """
    if not node_names:
        return {"cpu_m": 0, "memory_bytes": 0}

    node_set = set(node_names)
    v1 = client.CoreV1Api()

    total_cpu = 0
    total_mem = 0

    try:
        token = None
        while True:
            resp = v1.list_pod_for_all_namespaces(
                limit=500,
                _continue=token,
                timeout_seconds=30,
            )
            for pod in resp.items or []:
                node_name = getattr(pod.spec, "node_name", None)
                if not node_name or node_name not in node_set:
                    continue

                phase = (getattr(pod.status, "phase", None) or "").lower()
                # succeeded/failed pods do not hold resources for scheduling
                if phase in ("succeeded", "failed"):
                    continue

                req = _pod_requested_resources(pod)
                total_cpu += req["cpu_m"]
                total_mem += req["memory_bytes"]

            token = getattr(resp.metadata, "_continue", None) or getattr(resp.metadata, "continue", None)
            if not token:
                break

    except Exception as e:
        logger.warning(f"Capacity requests aggregation failed: {e}")
        return {"cpu_m": 0, "memory_bytes": 0}

    return {"cpu_m": total_cpu, "memory_bytes": total_mem}


# ============================================================================
# MAIN CAPACITY CALCULATION
# ============================================================================

def compute_and_store_capacity() -> Dict:
    """
    Compute:
        - total allocatable CPU & memory
        - total used by pods (from metrics server)
        - remaining = allocatable - used

    And store into MongoDB as:
        stats: { _id: "capacity", ... }
    """

    # Fetch nodes
    nodes = client.CoreV1Api().list_node().items

    # Apply availability, selector + tolerations
    sel = config.K8S_JOB_NODE_SELECTOR
    tol = config.K8S_JOB_TOLERATIONS
    matched = [n for n in nodes if node_is_available(n) and node_matches(n, sel, tol)]
    matched_names = [n.metadata.name for n in matched]

    # ----- Allocatable totals -----
    total_alloc_cpu = sum(parse_cpu(n.status.allocatable["cpu"]) for n in matched)
    total_alloc_mem = sum(parse_mem(n.status.allocatable["memory"]) for n in matched)

    # ----- Used by requests (scheduler semantics) -----
    used_requests = _fetch_pods_requests_by_node(matched_names)

    # ----- Actual usage (metrics.k8s.io; best-effort) -----
    used_usage = _fetch_pods_usage_by_node(matched_names)

    # ----- Remaining -----
    # "remaining" is schedulable remaining (allocatable - requested), matching kube-scheduler.
    remaining_cpu = max(0, total_alloc_cpu - used_requests["cpu_m"])
    remaining_mem = max(0, total_alloc_mem - used_requests["memory_bytes"])

    # Build your Pydantic model (no 'allocated' in response; 'remaining' instead)
    cap = models.Capacity(
        nodesTotal=len(matched),
        nodesMatching=len(matched),
        capacity=models.CapacityResources(cpu_m=total_alloc_cpu, memory_bytes=total_alloc_mem),
        remaining=models.CapacityResources(cpu_m=remaining_cpu, memory_bytes=remaining_mem),
        usedRequests=models.CapacityResources(cpu_m=used_requests["cpu_m"], memory_bytes=used_requests["memory_bytes"]),
        usedUsage=models.CapacityResources(cpu_m=used_usage["cpu_m"], memory_bytes=used_usage["memory_bytes"]),
        updatedAt=datetime.utcnow(),
    ).dict()

    # Store into MongoDB
    db.mongo.stats.update_one({"_id": "capacity"}, {"$set": cap}, upsert=True)

    return cap


def get_capacity() -> Dict:

    doc = db.mongo.stats.find_one({"_id": "capacity"}) or {}
    payload = {k: v for k, v in doc.items() if k != "_id"}

    if not payload:
        return models.Capacity().dict()

    return models.Capacity(**payload).dict()
