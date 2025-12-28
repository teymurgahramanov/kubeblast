from datetime import datetime
from typing import Dict, List
import re
import ssl
import httpx

from kubernetes import client

from config import config
from core import db, models


# ============================================================================
# CPU & MEMORY PARSING
# ============================================================================

_CPU_PATTERN = re.compile(r"^(\d+(\.\d+)?)(m|n|u)?$")
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
# METRICS SERVER CLIENT
# ============================================================================

def _get_metrics_client() -> httpx.Client:
    """Create an HTTP client configured for in-cluster metrics server access."""
    # Read service account token for authentication
    try:
        with open("/var/run/secrets/kubernetes.io/serviceaccount/token", "r") as f:
            token = f.read().strip()
    except FileNotFoundError:
        token = None
    
    # Read CA cert for TLS verification
    ca_cert_path = "/var/run/secrets/kubernetes.io/serviceaccount/ca.crt"
    
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    # Create SSL context
    try:
        ssl_context = ssl.create_default_context(cafile=ca_cert_path)
    except Exception:
        ssl_context = False  # Skip verification if CA cert not found
    
    return httpx.Client(
        base_url=config.K8S_METRICS_SERVER,
        headers=headers,
        verify=ssl_context,
        timeout=30.0,
    )


def _fetch_node_metrics() -> Dict[str, Dict[str, int]]:
    """
    Fetch node metrics from metrics server.
    Returns: {node_name: {"cpu_m": int, "memory_bytes": int}}
    """
    result = {}
    
    try:
        with _get_metrics_client() as client:
            response = client.get("/apis/metrics.k8s.io/v1beta1/nodes")
            response.raise_for_status()
            data = response.json()
            
            for item in data.get("items", []):
                node_name = item.get("metadata", {}).get("name", "")
                usage = item.get("usage", {})
                
                result[node_name] = {
                    "cpu_m": parse_cpu(usage.get("cpu", "0")),
                    "memory_bytes": parse_mem(usage.get("memory", "0")),
                }
    except Exception:
        # If metrics server is unavailable, return empty dict
        pass
    
    return result


def _fetch_pod_metrics() -> Dict[str, Dict[str, int]]:
    """
    Fetch pod metrics from metrics server.
    Returns: {node_name: {"cpu_m": int, "memory_bytes": int}} aggregated by node
    """
    result: Dict[str, Dict[str, int]] = {}
    
    try:
        with _get_metrics_client() as client:
            response = client.get("/apis/metrics.k8s.io/v1beta1/pods")
            response.raise_for_status()
            data = response.json()
            
            # We need to map pods to nodes - get pod list from k8s API
            v1 = client.CoreV1Api() if hasattr(client, 'CoreV1Api') else None
    except Exception:
        pass
    
    return result


def _fetch_pods_usage_by_node(node_names: List[str]) -> Dict[str, int]:
    """
    Fetch pod metrics from metrics server and aggregate usage by matching nodes.
    Returns: {"cpu_m": total, "memory_bytes": total}
    """
    total_cpu = 0
    total_mem = 0
    
    if not node_names:
        return {"cpu_m": 0, "memory_bytes": 0}
    
    node_set = set(node_names)
    v1 = client.CoreV1Api()
    
    try:
        with _get_metrics_client() as http_client:
            response = http_client.get("/apis/metrics.k8s.io/v1beta1/pods")
            response.raise_for_status()
            metrics_data = response.json()
            
            # Build a map of pod -> node from the k8s API
            pod_node_map = {}
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
    
    except Exception:
        # If metrics server is unavailable, return zeros
        pass
    
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

    # Apply selector + tolerations
    sel = config.K8S_JOB_NODE_SELECTOR
    tol = config.K8S_JOB_TOLERATIONS
    matched = [n for n in nodes if node_matches(n, sel, tol)]
    matched_names = [n.metadata.name for n in matched]

    # ----- Allocatable totals -----
    total_alloc_cpu = sum(parse_cpu(n.status.allocatable["cpu"]) for n in matched)
    total_alloc_mem = sum(parse_mem(n.status.allocatable["memory"]) for n in matched)

    # ----- Get usage from metrics server -----
    usage = _fetch_pods_usage_by_node(matched_names)

    # ----- Remaining -----
    remaining_cpu = max(0, total_alloc_cpu - usage["cpu_m"])
    remaining_mem = max(0, total_alloc_mem - usage["memory_bytes"])

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
