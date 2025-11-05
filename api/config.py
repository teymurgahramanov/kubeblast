import os
import json
import random
import string
from dotenv import load_dotenv

load_dotenv()

class Config:

    # General
    IS_PRO = False
    PRO_LICENSE_KEY: str = os.getenv("PRO_LICENSE_KEY")
    PRO_LICENSE_ID: str = os.getenv("PRO_LICENSE_ID")

    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    SECRET_KEY: str = os.getenv("SECRET_KEY", ''.join(random.choices(string.ascii_letters + string.digits)))
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    PER_USER_CURRENT_JOBS_LIMIT: int = int(os.getenv("PER_USER_CURRENT_JOBS_LIMIT", 3))
    WORKER_WATCH_INTERVAL: int = 3

    # Database
    MONGODB_HOST: str = os.getenv("MONGODB_HOST", "localhost")
    MONGODB_PORT: int = int(os.getenv("MONGODB_PORT", 27017))
    MONGODB_USER: str = os.getenv("MONGODB_USER", "kubeblast")
    MONGODB_PASS: str = os.getenv("MONGODB_PASS", "kubeblast")
    MONGODB_NAME: str = os.getenv("MONGODB_NAME", "kubeblast")
    MONGODB_URI: str = f"mongodb://{MONGODB_USER}:{MONGODB_PASS}@{MONGODB_HOST}:{MONGODB_PORT}/{MONGODB_NAME}"

    # Storage
    STORAGE_DIR: str = "/data"
    STORAGE_PVC_NAME: str = os.getenv("STORAGE_PVC_NAME")
    
    # Job
    K8S_JOB_PRIORITY_CLASS: str = os.getenv("K8S_JOB_PRIORITY_CLASS", None)
    K8S_JOB_IMAGE: str = os.getenv("K8S_JOB_IMAGE", "alpine/jmeter:5.6")
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
    LDAP_VERIFY_CERT: bool = os.getenv("LDAP_VERIFY_CERT", "false").lower() == "true"

    # OAuth Configuration
    OAUTH_ENABLED: bool = os.getenv("OAUTH_ENABLED", "false").lower() == "true"
    OAUTH_CLIENT_ID: str = os.getenv("OAUTH_CLIENT_ID")
    OAUTH_CLIENT_SECRET: str = os.getenv("OAUTH_CLIENT_SECRET")
    OAUTH_REDIRECT_URI: str = os.getenv("OAUTH_REDIRECT_URI", "http://localhost:3000/login")
    OAUTH_AUTH_URL: str = os.getenv("OAUTH_AUTH_URL")
    OAUTH_TOKEN_URL: str = os.getenv("OAUTH_TOKEN_URL")
    OAUTH_USERINFO_URL: str = os.getenv("OAUTH_USERINFO_URL")
    OAUTH_SCOPES: list = os.getenv("OAUTH_SCOPES", "openid profile email").split()
    
    # OAuth Role Mapping (JSON format)
    OAUTH_ROLE_MAPPING: dict = {}
    oauth_role_mapping_env = os.getenv("OAUTH_ROLE_MAPPING")
    if oauth_role_mapping_env:
        try:
            OAUTH_ROLE_MAPPING = json.loads(oauth_role_mapping_env)
        except json.JSONDecodeError:
            OAUTH_ROLE_MAPPING = {}
    
    OAUTH_DEFAULT_ROLE: str = os.getenv("OAUTH_DEFAULT_ROLE", "user")
    OAUTH_AUTO_CREATE_USERS: bool = os.getenv("OAUTH_AUTO_CREATE_USERS", "true").lower() == "true"

config = Config()