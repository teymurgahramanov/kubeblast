import os
import json
import random
import string
from dotenv import load_dotenv

load_dotenv()

class Config:

    # General
    IS_PRO = False

    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    SECRET_KEY: str = os.getenv("SECRET_KEY", ''.join(random.choices(string.ascii_letters + string.digits)))
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    PER_USER_CURRENT_JOBS_LIMIT: int = int(os.getenv("PER_USER_CURRENT_JOBS_LIMIT", 3))
    WORKER_WATCH_INTERVAL: int = 3

    # Database
    MONGO_HOST: str = os.getenv("MONGO_HOST", "localhost")
    MONGO_PORT: int = int(os.getenv("MONGO_PORT", 27017))
    MONGO_DB_USER: str = os.getenv("MONGO_DB_USER", "kubeblast")
    MONGO_DB_PASS: str = os.getenv("MONGO_DB_PASS", "kubeblast")
    MONGO_DB_NAME: str = os.getenv("MONGO_DB_NAME", "kubeblast")
    MONGO_URI: str = f"mongodb://{MONGO_DB_USER}:{MONGO_DB_PASS}@{MONGO_HOST}:{MONGO_PORT}/{MONGO_DB_NAME}"

    # Storage
    STORAGE_BACKEND: str = os.getenv("STORAGE_BACKEND", "fs") # fs, s3
    STORAGE_DIR: str = "/data"
    STORAGE_PVC_NAME: str = os.getenv("STORAGE_PVC_NAME")
    
    S3_URL: str = os.getenv("S3_URL",None)
    S3_ACCESS_KEY: str = os.getenv("S3_ACCESS_KEY")
    S3_SECRET_KEY: str = os.getenv("S3_SECRET_KEY")
    S3_REGION: str = os.getenv("S3_REGION", "us-east-1")
    S3_BUCKET: str = os.getenv("S3_BUCKET")
    
    # Job
    K8S_JOB_IMAGE: str = os.getenv("K8S_JOB_IMAGE", "alpine/jmeter:5.6")
    K8S_JOB_HELPER_IMAGE_S3: str = os.getenv("K8S_JOB_HELPER_IMAGE_S3", "amazon/aws-cli:2.27.12")
    K8S_JOB_HELPER_IMAGE_FS: str = os.getenv("K8S_JOB_HELPER_IMAGE_FS", "alpine:3.18")
    if STORAGE_BACKEND == "s3":
        K8S_JOB_HELPER_IMAGE = K8S_JOB_HELPER_IMAGE_S3
    else:
        K8S_JOB_HELPER_IMAGE = K8S_JOB_HELPER_IMAGE_FS
    K8S_JOB_IMAGE_PULL_POLICY: str = os.getenv("K8S_JOB_IMAGE_PULL_POLICY", "IfNotPresent")

    # Load Kubernetes Image Pull Secrets from JSON format
    K8S_JOB_IMAGE_PULL_SECRETS: list = []
    image_pull_secrets_env = os.getenv("K8S_JOB_IMAGE_PULL_SECRETS")
    if image_pull_secrets_env:
        try:
            K8S_JOB_IMAGE_PULL_SECRETS = json.loads(image_pull_secrets_env)
        except json.JSONDecodeError:
            K8S_JOB_IMAGE_PULL_SECRETS = None
    
    # Load Kubernetes NodeSelector from JSON format
    K8S_JOB_NODE_SELECTOR: dict = {}
    job_node_selector_env = os.getenv("K8S_JOB_NODE_SELECTOR")
    if job_node_selector_env:
        try:
            K8S_JOB_NODE_SELECTOR = json.loads(job_node_selector_env)
        except json.JSONDecodeError:
            K8S_JOB_NODE_SELECTOR = None

    # Load Kubernetes Tolerations from JSON format
    K8S_JOB_TOLERATIONS: list = []
    job_tolerations_env = os.getenv("K8S_JOB_TOLERATIONS")
    if job_tolerations_env:
        try:
            K8S_JOB_TOLERATIONS = json.loads(job_tolerations_env)
        except json.JSONDecodeError:
            K8S_JOB_TOLERATIONS = None

    # Load Kubernetes Resources from JSON format
    K8S_JOB_RESOURCES: dict = {}
    job_resources_env = os.getenv("K8S_JOB_RESOURCES", None)
    if job_resources_env:
        try:
            K8S_JOB_RESOURCES = json.loads(job_resources_env)
        except json.JSONDecodeError:
            K8S_JOB_RESOURCES = None

    # LDAP Configuration
    LDAP_ENABLED: bool = os.getenv("LDAP_ENABLED", "false").lower() == "true"
    LDAP_SERVER: str = os.getenv("LDAP_SERVER")
    LDAP_BASE_DN: str = os.getenv("LDAP_BASE_DN")
    LDAP_BIND_DN: str = os.getenv("LDAP_BIND_DN")
    LDAP_BIND_PASSWORD: str = os.getenv("LDAP_BIND_PASSWORD")
    LDAP_USER_SEARCH_FILTER: str = os.getenv("LDAP_USER_SEARCH_FILTER", "(&(objectClass=person)(sAMAccountName={username}))")
    LDAP_GROUP_SEARCH_FILTER: str = os.getenv("LDAP_GROUP_SEARCH_FILTER", "(&(objectClass=group)(member={dn}))")
    LDAP_USER_ATTRIBUTES: list = os.getenv("LDAP_USER_ATTRIBUTES", "uid,sAMAccountName,cn,mail,memberOf").split(",")
    LDAP_GROUP_ATTRIBUTES: list = os.getenv("LDAP_GROUP_ATTRIBUTES", "cn,member").split(",")
    LDAP_USE_TLS: bool = os.getenv("LDAP_USE_TLS", "false").lower() == "true"
    LDAP_VERIFY_CERT: bool = os.getenv("LDAP_VERIFY_CERT", "true").lower() == "true"

config = Config()