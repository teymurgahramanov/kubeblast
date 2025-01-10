import os

class Config:
    APP_NAME: str = "JMeter Kubernetes API"
    DEBUG: bool = False

    MINIO_ENDPOINT: str = os.getenv("MINIO_ENDPOINT", "localhost:9000")
    MINIO_ACCESS_KEY: str = os.getenv("MINIO_ACCESS_KEY", "your_access_key")
    MINIO_SECRET_KEY: str = os.getenv("MINIO_SECRET_KEY", "your_secret_key")

    K8S_NAMESPACE: str = os.getenv("K8S_NAMESPACE", "default")
    K8S_JOB_TIMEOUT: int = int(os.getenv("K8S_JOB_TIMEOUT", 300))
    K8S_CONFIGMAP_KEY: str = "plan.jmx"

config = Config()