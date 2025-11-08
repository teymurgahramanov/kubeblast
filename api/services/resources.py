from typing import Dict, List, Optional
from kubernetes import client
from config import config
from core import k8s, db


def _parse_cpu_to_millicores(cpu: Optional[str]) -> int:
    if not cpu:
        return 0
    cpu = str(cpu).strip()
    if cpu.endswith("m"):
        try:
            return int(cpu[:-1])
        except ValueError:
            return 0
    try:
        return int(float(cpu) * 1000)
    except ValueError:
        return 0


_MEMORY_UNITS = {
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


def _parse_memory_to_bytes(mem: Optional[str]) -> int:
    if not mem:
        return 0
    value = str(mem).strip()
    for unit in sorted(_MEMORY_UNITS.keys(), key=len, reverse=True):
        if value.endswith(unit):
            number_part = value[: -len(unit)]
            try:
                return int(float(number_part) * _MEMORY_UNITS[unit])
            except ValueError:
                return 0
    try:
        return int(float(value))
    except ValueError:
        return 0


def _node_matches_selector(node: client.V1Node, selector: Optional[Dict[str, str]]) -> bool:
    if not selector:
        return True
    labels = node.metadata.labels or {}
    for key, expected in selector.items():
        if labels.get(key) != expected:
            return False
    return True


def _taint_is_tolerated(taint: client.V1Taint, tolerations: List[Dict]) -> bool:
    if taint.effect == "PreferNoSchedule":
        return True
    if not tolerations:
        return False
    for tol in tolerations:
        tol_key = tol.get("key")
        tol_op = (tol.get("operator") or "Equal").capitalize()
        tol_val = tol.get("value")
        tol_eff = tol.get("effect")

        if tol_key != taint.key:
            continue
        if tol_eff and tol_eff != taint.effect:
            continue
        if tol_op == "Exists":
            return True
        if tol_val is None:
            continue
        if tol_val == taint.value:
            return True
    return False


def _node_taints_tolerated(node: client.V1Node, tolerations: Optional[List[Dict]]) -> bool:
    taints = (node.spec and node.spec.taints) or []
    for taint in taints:
        if taint.effect in ("NoSchedule", "NoExecute") and not _taint_is_tolerated(taint, tolerations or []):
            return False
    return True


def get_cluster_resources(current_user=None) -> Dict:
    v1 = client.CoreV1Api()
    nodes = v1.list_node().items

    selector = config.K8S_JOB_NODE_SELECTOR
    tolerations = config.K8S_JOB_TOLERATIONS

    matched_nodes: List[client.V1Node] = []
    for node in nodes:
        if not _node_matches_selector(node, selector):
            continue
        if not _node_taints_tolerated(node, tolerations):
            continue
        matched_nodes.append(node)

    total_cpu_m = 0
    total_mem_b = 0
    alloc_cpu_m = 0
    alloc_mem_b = 0

    for node in matched_nodes:
        cap = (node.status and node.status.capacity) or {}
        allo = (node.status and node.status.allocatable) or {}

        total_cpu_m += _parse_cpu_to_millicores(cap.get("cpu"))
        alloc_cpu_m += _parse_cpu_to_millicores(allo.get("cpu"))
        total_mem_b += _parse_memory_to_bytes(cap.get("memory"))
        alloc_mem_b += _parse_memory_to_bytes(allo.get("memory"))

    user_jobs_total = 0
    if current_user is not None and getattr(current_user, "username", None):
        user_jobs_total = db.mongo.jobs.count_documents({"owner": current_user.username})

    return {
        "nodesTotal": len(matched_nodes),
        "capacity": {"cpu_m": total_cpu_m, "memory_bytes": total_mem_b},
        "allocatable": {"cpu_m": alloc_cpu_m, "memory_bytes": alloc_mem_b},
        "perUserCurrentJobsLimit": config.PER_USER_CURRENT_JOBS_LIMIT,
        "userJobsTotal": user_jobs_total,
    }


