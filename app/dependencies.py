from kubernetes import client, config

def get_kubernetes_client_batch():
  config.load_incluster_config()
  return client.BatchV1Api()

def get_kubernetes_client_core():
  config.load_incluster_config()
  return client.CoreV1Api()

kubernetes_client_batch = get_kubernetes_client_batch()
kubernetes_client_core = get_kubernetes_client_core()