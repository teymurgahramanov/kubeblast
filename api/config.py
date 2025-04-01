import os
import json
from dotenv import load_dotenv

load_dotenv()

class Config:
    if os.getenv("IS_PRO") == "true":
        IS_PRO = True
    else:
        IS_PRO = False

    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")

    CURRENT_JOBS_LIMIT: int = int(os.getenv("CURRENT_JOBS_LIMIT", 3))

    SECRET_KEY: str = os.getenv("SECRET_KEY", "secret_key") # openssl rand -hex 32
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 30))

    MONGO_HOST: str = os.getenv("MONGO_HOST", "localhost")
    MONGO_PORT: int = int(os.getenv("MONGO_PORT", 27017))
    MONGO_DB_USER: str = os.getenv("MONGO_DB_USER", "jrunner")
    MONGO_DB_PASS: str = os.getenv("MONGO_DB_PASS", "jrunner")
    MONGO_DB_NAME: str = os.getenv("MONGO_DB_NAME", "jrunner")
    MONGO_URI: str = f"mongodb://{MONGO_DB_USER}:{MONGO_DB_PASS}@{MONGO_HOST}:{MONGO_PORT}/{MONGO_DB_NAME}"

    S3_URL: str = os.getenv("S3_URL")
    S3_ACCESS_KEY: str = os.getenv("S3_ACCESS_KEY")
    S3_SECRET_KEY: str = os.getenv("S3_SECRET_KEY")
    S3_REGION: str = os.getenv("S3_REGION", "us-east-1")
    S3_BUCKET: str = os.getenv("S3_BUCKET")
    
    # Load Kubernetes NodeSelector from JSON or parse key-value pairs
    K8S_JOB_IMAGE: str = os.getenv("K8S_JOB_IMAGE", "alpine/jmeter:5.6")
    K8S_JOB_JMETER_JVM_ARGS: str = os.getenv("K8S_JOB_JMETER_JVM_ARGS", "")
    
    K8S_JOB_SLAVE_RESOURCES: dict = {}
    # Load Kubernetes Slave Resources from JSON format
    slave_resources_env = os.getenv("K8S_JOB_SLAVE_RESOURCES")
    if slave_resources_env:
        try:
            K8S_JOB_SLAVE_RESOURCES = json.loads(slave_resources_env)
        except json.JSONDecodeError:
            K8S_JOB_SLAVE_RESOURCES = None
    
    
    K8S_JOB_MASTER_RESOURCES: dict = {}
    # Load Kubernetes Master Resources from JSON format
    master_resources_env = os.getenv("K8S_JOB_MASTER_RESOURCES")
    if master_resources_env:
        try:
            K8S_JOB_MASTER_RESOURCES = json.loads(master_resources_env)
        except json.JSONDecodeError:
            K8S_JOB_MASTER_RESOURCES = None
    
    K8S_JOB_NODE_SELECTOR: dict = {}
    # Load Kubernetes NodeSelector from JSON format
    job_node_selector_env = os.getenv("K8S_JOB_NODE_SELECTOR")
    if job_node_selector_env:
        try:
            K8S_JOB_NODE_SELECTOR = json.loads(job_node_selector_env)
        except json.JSONDecodeError:
            K8S_JOB_NODE_SELECTOR = None

    
    K8S_JOB_TOLERATIONS: list = []
    # Load Kubernetes Tolerations from JSON format
    job_tolerations_env = os.getenv("K8S_JOB_TOLERATIONS")
    if job_tolerations_env:
        try:
            K8S_JOB_TOLERATIONS = json.loads(job_tolerations_env)
        except json.JSONDecodeError:
            K8S_JOB_TOLERATIONS = None

config = Config()