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

    PER_USER_CURRENT_JOBS_LIMIT: int = int(os.getenv("PER_USER_CURRENT_JOBS_LIMIT", 3))

    SECRET_KEY: str = os.getenv("SECRET_KEY", "secret_key") # openssl rand -hex 32
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 30))
    
    WORKER_WATCH_INTERVAL: int = int(os.getenv("WORKER_WATCH_INTERVAL", 3))

    MONGO_HOST: str = os.getenv("MONGO_HOST", "localhost")
    MONGO_PORT: int = int(os.getenv("MONGO_PORT", 27017))
    MONGO_DB_USER: str = os.getenv("MONGO_DB_USER", "kubeblast")
    MONGO_DB_PASS: str = os.getenv("MONGO_DB_PASS", "kubeblast")
    MONGO_DB_NAME: str = os.getenv("MONGO_DB_NAME", "kubeblast")
    MONGO_URI: str = f"mongodb://{MONGO_DB_USER}:{MONGO_DB_PASS}@{MONGO_HOST}:{MONGO_PORT}/{MONGO_DB_NAME}"

    S3_URL: str = os.getenv("S3_URL")
    S3_ACCESS_KEY: str = os.getenv("S3_ACCESS_KEY")
    S3_SECRET_KEY: str = os.getenv("S3_SECRET_KEY")
    S3_REGION: str = os.getenv("S3_REGION", "us-east-1")
    S3_BUCKET: str = os.getenv("S3_BUCKET")
    
    # Load Kubernetes NodeSelector from JSON or parse key-value pairs
    K8S_JOB_IMAGE: str = os.getenv("K8S_JOB_IMAGE", "alpine/jmeter:5.6")
    K8S_JOB_IMAGE_PULL_POLICY: str = os.getenv("K8S_JOB_IMAGE_PULL_POLICY", "IfNotPresent")

    K8S_JOB_IMAGE_PULL_SECRETS: list = []
    # Load Kubernetes Image Pull Secrets from JSON format
    image_pull_secrets_env = os.getenv("K8S_JOB_IMAGE_PULL_SECRETS")
    if image_pull_secrets_env:
        try:
            K8S_JOB_IMAGE_PULL_SECRETS = json.loads(image_pull_secrets_env)
        except json.JSONDecodeError:
            K8S_JOB_IMAGE_PULL_SECRETS = None
    
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

    # LDAP Configuration
    LDAP_ENABLED: bool = os.getenv("LDAP_ENABLED", "false").lower() == "true"
    LDAP_SERVER: str = os.getenv("LDAP_SERVER", "ldap://localhost:389")
    LDAP_BASE_DN: str = os.getenv("LDAP_BASE_DN", "ou=users,dc=example,dc=com")
    LDAP_BIND_DN: str = os.getenv("LDAP_BIND_DN", "cn=admin,dc=example,dc=com")
    LDAP_BIND_PASSWORD: str = os.getenv("LDAP_BIND_PASSWORD", "")
    LDAP_USER_SEARCH_FILTER: str = os.getenv("LDAP_USER_SEARCH_FILTER", "(uid={})")
    LDAP_GROUP_SEARCH_FILTER: str = os.getenv("LDAP_GROUP_SEARCH_FILTER", "(member={})")
    LDAP_USER_ATTRIBUTES: list = ["uid", "sAMAccountName", "cn", "mail", "memberOf"]
    LDAP_GROUP_ATTRIBUTES: list = ["cn", "member"]

config = Config()