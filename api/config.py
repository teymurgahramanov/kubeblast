import json
import os
import random
import string
from typing import ClassVar

from dotenv import load_dotenv

load_dotenv()

class Config:

    # General
    APP_VERSION: str = "1.3.0"
    LICENSE_VALID: bool = False
    LICENSE_KEY: str | None = os.getenv("LICENSE_KEY")
    LICENSE_ID: str | None = os.getenv("LICENSE_ID")

    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    SECRET_KEY: str = os.getenv("SECRET_KEY", ''.join(random.choices(string.ascii_letters + string.digits)))
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    TIMEZONE: str = os.getenv("TIMEZONE", "UTC")
    PAT_STRING_PREFIX: str = "kb_pat"

    # JMeter execution mode
    # Values: "standalone" (default) or "distributed"
    JMETER_MODE: str = os.getenv("JMETER_MODE", "standalone")
    JMETER_MODE = JMETER_MODE.lower().strip()
    if JMETER_MODE not in ("standalone", "distributed"):
        JMETER_MODE = "standalone"
    
    PER_USER_CURRENT_JOBS_LIMIT: int = int(os.getenv("PER_USER_CURRENT_JOBS_LIMIT", "3"))
    # Worker job status sync:
    # - Uses Kubernetes watch (event-driven) as primary mechanism
    # - Periodically does a full resync as a safety net (missed events / restarts)
    WORKER_WATCH_INTERVAL: int = int(os.getenv("WORKER_WATCH_INTERVAL", "300"))  # seconds (full resync interval)
    WORKER_WATCH_TIMEOUT: int = int(os.getenv("WORKER_WATCH_TIMEOUT", "60"))    # seconds (watch stream timeout)

    # Capacity updater interval (seconds)
    CAPACITY_WARM_INTERVAL: int = 10

    # Delay before first capacity / job-worker sync so the API can bind and serve health checks first
    STARTUP_CAPACITY_STAGGER_S: int = 5
    STARTUP_WORKER_STAGGER_S: int = 5

    # Metrics server URL for capacity data
    K8S_METRICS_SERVER: str = os.getenv("K8S_METRICS_SERVER", "https://metrics-server.kube-system")

    # InfluxDB (JMeter real-time metrics)
    INFLUXDB_ENABLED: bool = os.getenv("INFLUXDB_ENABLED", "false").lower() == "true"
    INFLUXDB_URL: str = os.getenv("INFLUXDB_URL", "http://localhost:8086")
    INFLUXDB_DATABASE: str = os.getenv("INFLUXDB_DATABASE", "jmeter")

    # Database
    MONGODB_HOST: str = os.getenv("MONGODB_HOST", "localhost")
    MONGODB_PORT: int = int(os.getenv("MONGODB_PORT", "27017"))
    MONGODB_USER: str = os.getenv("MONGODB_USER", "kubeblast")
    MONGODB_PASS: str = os.getenv("MONGODB_PASS", "kubeblast")
    MONGODB_NAME: str = os.getenv("MONGODB_NAME", "kubeblast")
    MONGODB_PARAMS: str = os.getenv("MONGODB_PARAMS", "")
    MONGODB_URI: str = os.getenv(
        "MONGODB_URI",
        f"mongodb://{MONGODB_USER}:{MONGODB_PASS}@{MONGODB_HOST}:{MONGODB_PORT}/{MONGODB_NAME}{MONGODB_PARAMS}",
    )

    # Storage
    STORAGE_DIR: str = "/data"
    STORAGE_PVC_NAME: str | None = os.getenv("STORAGE_PVC_NAME")
    
    # Job
    K8S_JOB_PRIORITY_CLASS: str | None = os.getenv("K8S_JOB_PRIORITY_CLASS")
    K8S_JOB_IMAGE: str = os.getenv("K8S_JOB_IMAGE", "alpine/jmeter:5.6")
    K8S_JOB_IMAGE_PULL_POLICY: str = os.getenv("K8S_JOB_IMAGE_PULL_POLICY", "IfNotPresent")

    # Load Kubernetes Image Pull Secrets from JSON format
    K8S_JOB_IMAGE_PULL_SECRETS: ClassVar[list] = []
    image_pull_secrets_env = os.getenv("K8S_JOB_IMAGE_PULL_SECRETS")
    if image_pull_secrets_env:
        try:
            K8S_JOB_IMAGE_PULL_SECRETS = json.loads(image_pull_secrets_env)
        except json.JSONDecodeError:
            K8S_JOB_IMAGE_PULL_SECRETS = []
    
    # Load Kubernetes NodeSelector from JSON format
    K8S_JOB_NODE_SELECTOR: ClassVar[dict] = {}
    job_node_selector_env = os.getenv("K8S_JOB_NODE_SELECTOR")
    if job_node_selector_env:
        try:
            K8S_JOB_NODE_SELECTOR = json.loads(job_node_selector_env)
        except json.JSONDecodeError:
            K8S_JOB_NODE_SELECTOR = {}

    # Load Kubernetes Tolerations from JSON format
    K8S_JOB_TOLERATIONS: ClassVar[list] = []
    job_tolerations_env = os.getenv("K8S_JOB_TOLERATIONS")
    if job_tolerations_env:
        try:
            K8S_JOB_TOLERATIONS = json.loads(job_tolerations_env)
        except json.JSONDecodeError:
            K8S_JOB_TOLERATIONS = []

    # Load Kubernetes Resources from JSON format
    K8S_JOB_RESOURCES: ClassVar[dict] = {}
    job_resources_env = os.getenv("K8S_JOB_RESOURCES")
    if job_resources_env:
        try:
            K8S_JOB_RESOURCES = json.loads(job_resources_env)
        except json.JSONDecodeError:
            K8S_JOB_RESOURCES = {}

    # load Kubernetes Job Resources for Jmeter Master in distributed mode
    K8S_JOB_RESOURCES_MASTER: ClassVar[dict] = {}
    job_resources_master_env = os.getenv("K8S_JOB_RESOURCES_MASTER")
    if job_resources_master_env:
        try:
            K8S_JOB_RESOURCES_MASTER = json.loads(job_resources_master_env)
        except json.JSONDecodeError:
            K8S_JOB_RESOURCES_MASTER = {}

    # LDAP Configuration
    LDAP_ENABLED: bool = os.getenv("LDAP_ENABLED", "false").lower() == "true"
    LDAP_SERVER: str | None = os.getenv("LDAP_SERVER")
    LDAP_BASE_DN: str | None = os.getenv("LDAP_BASE_DN")
    LDAP_BIND_DN: str | None = os.getenv("LDAP_BIND_DN")
    LDAP_BIND_PASSWORD: str | None = os.getenv("LDAP_BIND_PASSWORD")
    LDAP_USER_SEARCH_FILTER: str = os.getenv("LDAP_USER_SEARCH_FILTER", "(&(objectClass=person)(sAMAccountName={username}))")
    LDAP_GROUP_SEARCH_FILTER: str = os.getenv("LDAP_GROUP_SEARCH_FILTER", "(&(objectClass=group)(member={dn}))")
    LDAP_USER_ATTRIBUTES: list = os.getenv("LDAP_USER_ATTRIBUTES", "uid,sAMAccountName,cn,mail,memberOf").split(",")
    LDAP_GROUP_ATTRIBUTES: list = os.getenv("LDAP_GROUP_ATTRIBUTES", "cn,member").split(",")
    LDAP_USE_TLS: bool = os.getenv("LDAP_USE_TLS", "false").lower() == "true"
    LDAP_VERIFY_CERT: bool = os.getenv("LDAP_VERIFY_CERT", "false").lower() == "true"

    # OIDC Configuration
    OIDC_ENABLED: bool = os.getenv("OIDC_ENABLED", "false").lower() == "true"
    OIDC_CLIENT_ID: str | None = os.getenv("OIDC_CLIENT_ID")
    OIDC_CLIENT_SECRET: str | None = os.getenv("OIDC_CLIENT_SECRET")
    OIDC_REDIRECT_URI: str = os.getenv("OIDC_REDIRECT_URI", "http://localhost:3000/login")
    OIDC_AUTH_URL: str | None = os.getenv("OIDC_AUTH_URL")
    OIDC_TOKEN_URL: str | None = os.getenv("OIDC_TOKEN_URL")
    OIDC_USERINFO_URL: str | None = os.getenv("OIDC_USERINFO_URL")
    OIDC_SCOPES: list = os.getenv("OIDC_SCOPES", "openid profile email").split()
    
    OIDC_ROLE_MAPPING: ClassVar[dict] = {}
    oidc_role_mapping_env = os.getenv("OIDC_ROLE_MAPPING")
    if oidc_role_mapping_env:
        try:
            OIDC_ROLE_MAPPING = json.loads(oidc_role_mapping_env)
        except json.JSONDecodeError:
            OIDC_ROLE_MAPPING = {}
    
    OIDC_DEFAULT_ROLE: str = os.getenv("OIDC_DEFAULT_ROLE", "user")
    OIDC_AUTO_CREATE_USERS: bool = os.getenv("OIDC_AUTO_CREATE_USERS", "true").lower() == "true"


config = Config()