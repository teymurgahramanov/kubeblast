import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    DEBUG: bool = False
    
    MONGO_HOST: str = os.getenv("MONGO_HOST", "localhost")
    MONGO_PORT: int = int(os.getenv("MONGO_PORT", 27017))
    MONGO_DB_USER: str = os.getenv("MONGO_DB_USER", "jrunner")
    MONGO_DB_PASS: str = os.getenv("MONGO_DB_PASS", "jrunner")
    MONGO_DB_NAME: str = os.getenv("MONGO_DB_NAME", "jrunner")
    MONGO_URI: str = f"mongodb://{MONGO_DB_USER}:{MONGO_DB_PASS}@{MONGO_HOST}:{MONGO_PORT}/{MONGO_DB_NAME}"
 
    K8S_NAMESPACE: str = os.getenv("K8S_NAMESPACE", "default")

    WORKER_WATCH_INTERVAL: int = os.getenv("WORKER_WATCH_INTERVAL", 30)

config = Config()