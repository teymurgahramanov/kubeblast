from kubernetes import client, config as k8s_config
from api.core.config import config

k8s_config.load_incluster_config()
namespace = config.K8S_NAMESPACE

def stream_pod_logs(job_name):

    try:
        pod_list = client.CoreV1Api().list_namespaced_pod(
            namespace=namespace,
            label_selector=f"job-name={job_name}"
        )
        if not pod_list.items:
            print(f"No Pods found for Job: {job_name}")
        
        pod_name = pod_list.items[0].metadata.name
        logs = client.CoreV1Api().read_namespaced_pod_log(
            name=pod_name,
            namespace=namespace,
            follow=True,
            _preload_content=False,
        )
        for line in logs.stream():
            yield line.decode("utf-8")
    except client.exceptions.ApiException as e:
        yield f"Error: {e.reason}\n"
        return