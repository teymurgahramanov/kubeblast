"""
Minimal Kubernetes capacity calculator.

Purpose:
    Show *real remaining* CPU and memory in the SIMPLEST way:
        remaining = sum(node.allocatable) - sum(all pod requests)

Preserves:
    - Your existing Pydantic models (core.models)
    - Your MongoDB storage structure
    - Node selectors & tolerations filtering
"""

from datetime import datetime
from typing import Dict, List
from concurrent.futures import ThreadPoolExecutor, as_completed

import re
from kubernetes import client

from config import config
from core import db, models


# ============================================================================
# CPU & MEMORY PARSING
# ============================================================================

_CPU_PATTERN = re.compile(r"^(\d+(\.\d+)?)(m?)$")
_MEM_PATTERN = re.compile(r"^(\d+(\.\d+)?)([KMGTP]i?)?$")

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
    if not cpu:
        return 0
    m = _CPU_PATTERN.match(cpu)
    if not m:
        return 0
    value, _, suffix = m.groups()
    return int(float(value) * (1 if suffix == "m" else 1000))


def parse_mem(mem: str) -> int:
    if not mem:
        return 0
    m = _MEM_PATTERN.match(mem)
    if not m:
        return 0
    value, _, unit = m.groups()
    return int(float(value) * _MEM_UNITS.get(unit or "", 1))


# ============================================================================
# NODE FILTERING (selector + tolerations)
# ============================================================================

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
# POD RESOURCE CALCULATION
# ============================================================================

def effective_pod_requests(pod) -> (int, int):
    cpu = mem = 0

    # main containers
    for c in pod.spec.containers or []:
        req = (c.resources.requests or {})
        cpu += parse_cpu(req.get("cpu"))
        mem += parse_mem(req.get("memory"))

    # init containers (max)
    init_cpu = init_mem = 0
    for ic in pod.spec.init_containers or []:
        req = (ic.resources.requests or {})
        init_cpu = max(init_cpu, parse_cpu(req.get("cpu")))
        init_mem = max(init_mem, parse_mem(req.get("memory")))

    cpu = max(cpu, init_cpu)
    mem = max(mem, init_mem)

    # pod overhead
    overhead = getattr(pod.spec, "overhead", {}) or {}
    cpu += parse_cpu(overhead.get("cpu"))
    mem += parse_mem(overhead.get("memory"))

    return cpu, mem


# ============================================================================
# POD ITERATOR
# ============================================================================

def _iter_active_pods_on_node(node_name: str):
    """Yield pods assigned to node and not finished."""
    v1 = client.CoreV1Api()
    field_selector = (
        f"spec.nodeName={node_name},"
        f"status.phase!=Succeeded,status.phase!=Failed"
    )
    token = None

    while True:
        resp = v1.list_pod_for_all_namespaces(
            field_selector=field_selector,
            limit=400,
            _continue=token,
            timeout_seconds=15,
        )

        for pod in resp.items or []:
            if getattr(pod.metadata, "deletion_timestamp", None):
                continue
            yield pod

        token = getattr(resp.metadata, "_continue", None) or getattr(resp.metadata, "continue", None)
        if not token:
            break


# ============================================================================
# ALLOCATED RESOURCES (MULTI-NODE)
# ============================================================================

def allocated_on_node(node_name: str) -> Dict[str, int]:
    cpu = mem = 0
    for pod in _iter_active_pods_on_node(node_name):
        c, m = effective_pod_requests(pod)
        cpu += c
        mem += m
    return {"cpu_m": cpu, "memory_bytes": mem}


def allocated_on_nodes(names: List[str]) -> Dict[str, int]:
    if not names:
        return {"cpu_m": 0, "memory_bytes": 0}

    total_cpu = total_mem = 0

    with ThreadPoolExecutor(max_workers=min(8, len(names))) as pool:
        futures = (pool.submit(allocated_on_node, n) for n in names)
        for f in as_completed(futures):
            r = f.result()
            total_cpu += r["cpu_m"]
            total_mem += r["memory_bytes"]

    return {"cpu_m": total_cpu, "memory_bytes": total_mem}


# ============================================================================
# MAIN SIMPLE CAPACITY CALCULATION
# ============================================================================

def compute_and_store_capacity() -> Dict:
    """
    Compute:
        - total allocatable CPU & memory
        - total used by pods
        - remaining = allocatable - used

    And store into MongoDB as:
        stats: { _id: "capacity", ... }
    """

    # Fetch nodes
    nodes = client.CoreV1Api().list_node().items

    # Apply selector + tolerations
    sel = config.K8S_JOB_NODE_SELECTOR
    tol = config.K8S_JOB_TOLERATIONS
    matched = [n for n in nodes if node_matches(n, sel, tol)]
    matched_names = [n.metadata.name for n in matched]

    # ----- Allocatable totals -----
    total_alloc_cpu = sum(parse_cpu(n.status.allocatable["cpu"]) for n in matched)
    total_alloc_mem = sum(parse_mem(n.status.allocatable["memory"]) for n in matched)

    # ----- Allocated to pods -----
    allocated = allocated_on_nodes(matched_names)

    # ----- Remaining -----
    remaining_cpu = max(0, total_alloc_cpu - allocated["cpu_m"])
    remaining_mem = max(0, total_alloc_mem - allocated["memory_bytes"])

    # Build your Pydantic model (no 'allocated' in response; 'remaining' instead)
    cap = models.Capacity(
        nodesTotal=len(nodes),
        nodesMatching=len(matched),
        capacity=models.CapacityResources(cpu_m=total_alloc_cpu, memory_bytes=total_alloc_mem),
        remaining=models.CapacityResources(cpu_m=remaining_cpu, memory_bytes=remaining_mem),
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
