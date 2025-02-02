from kubernetes import client, config as k8s_config

k8s_config.load_incluster_config()
api_client = client.ApiClient()