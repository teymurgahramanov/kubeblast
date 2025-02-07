import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    DEBUG: bool = False

    ADMIN_USERNAME: str = os.getenv("ADMIN_USERNAME", "admin")
    ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "admin")
    PENDING_JOBS_LIMIT: int = os.getenv("PENDING_JOBS_LIMIT", 3)

    SECRET_KEY: str = os.getenv("SECRET_KEY", "secret_key") # openssl rand -hex 32
    ACCESS_TOKEN_EXPIRE_MINUTES: int = os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 30)

    MONGO_HOST: str = os.getenv("MONGO_HOST", "localhost")
    MONGO_PORT: int = int(os.getenv("MONGO_PORT", 27017))
    MONGO_DB_USER: str = os.getenv("MONGO_DB_USER", "jrunner")
    MONGO_DB_PASS: str = os.getenv("MONGO_DB_PASS", "jrunner")
    MONGO_DB_NAME: str = os.getenv("MONGO_DB_NAME", "jrunner")
    MONGO_URI: str = f"mongodb://{MONGO_DB_USER}:{MONGO_DB_PASS}@{MONGO_HOST}:{MONGO_PORT}/{MONGO_DB_NAME}"

    PLAN_DIR = "plans"
    REPORT_DIR = "reports"

    K8S_NAMESPACE: str = os.getenv("K8S_NAMESPACE", "default")
    K8S_JOB_TIMEOUT: int = int(os.getenv("K8S_JOB_TIMEOUT", 300))
    K8S_CONFIGMAP_KEY: str = "plan.jmx"

config = Config()