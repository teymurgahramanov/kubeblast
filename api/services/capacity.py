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


def get_cluster_capacity(current_user=None) -> Dict:
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

    # Calculate allocated resources (sum of container requests) on matched nodes across all namespaces
    allocated_cpu_m = 0
    allocated_mem_b = 0

    matched_node_names = {n.metadata.name for n in matched_nodes}
    try:
        pods = client.CoreV1Api().list_pod_for_all_namespaces().items
        for pod in pods:
            # consider only non-terminated pods
            phase = getattr(pod.status, "phase", None)
            if phase in ("Succeeded", "Failed"):
                continue
            if getattr(getattr(pod, "metadata", None), "deletion_timestamp", None):
                continue

            node_name = getattr(pod.spec, "node_name", None)
            if not node_name or node_name not in matched_node_names:
                continue

            # Sum of app container requests
            pod_req_cpu_m = 0
            pod_req_mem_b = 0
            for container in getattr(pod.spec, "containers", []) or []:
                resources = getattr(container, "resources", None)
                requests = getattr(resources, "requests", None) if resources else None
                if not requests:
                    continue
                pod_req_cpu_m += _parse_cpu_to_millicores(requests.get("cpu"))
                pod_req_mem_b += _parse_memory_to_bytes(requests.get("memory"))

            # Max of init container requests
            init_max_cpu_m = 0
            init_max_mem_b = 0
            for ic in getattr(pod.spec, "init_containers", []) or []:
                resources = getattr(ic, "resources", None)
                requests = getattr(resources, "requests", None) if resources else None
                if not requests:
                    continue
                init_max_cpu_m = max(init_max_cpu_m, _parse_cpu_to_millicores(requests.get("cpu")))
                init_max_mem_b = max(init_max_mem_b, _parse_memory_to_bytes(requests.get("memory")))

            # Effective per-pod request is max(init) vs sum(app) for each resource
            eff_cpu_m = max(pod_req_cpu_m, init_max_cpu_m)
            eff_mem_b = max(pod_req_mem_b, init_max_mem_b)

            # Add pod overhead if defined
            overhead = getattr(pod.spec, "overhead", None)
            if isinstance(overhead, dict):
                eff_cpu_m += _parse_cpu_to_millicores(overhead.get("cpu"))
                eff_mem_b += _parse_memory_to_bytes(overhead.get("memory"))

            allocated_cpu_m += eff_cpu_m
            allocated_mem_b += eff_mem_b
    except Exception:
        # If listing pods fails, leave allocated as 0 to keep endpoint robust
        pass

    # Available = allocatable - allocated (clamped to zero)
    available_cpu_m = max(0, alloc_cpu_m - allocated_cpu_m)
    available_mem_b = max(0, alloc_mem_b - allocated_mem_b)

    user_jobs_total = 0
    if current_user is not None and getattr(current_user, "username", None):
        user_jobs_total = db.mongo.jobs.count_documents({"owner": current_user.username})

    return {
        "nodesTotal": len(nodes),
        "nodesMatching": len(matched_nodes),
        "capacity": {"cpu_m": total_cpu_m, "memory_bytes": total_mem_b},
        "allocated": {"cpu_m": allocated_cpu_m, "memory_bytes": allocated_mem_b},
        "allocatable": {"cpu_m": available_cpu_m, "memory_bytes": available_mem_b},
        "jobResources": config.K8S_JOB_RESOURCES or {},
        "perUserCurrentJobsLimit": config.PER_USER_CURRENT_JOBS_LIMIT,
        "userJobsTotal": user_jobs_total,
    }


