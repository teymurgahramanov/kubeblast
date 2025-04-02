import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    
    MONGO_HOST: str = os.getenv("MONGO_HOST", "localhost")
    MONGO_PORT: int = int(os.getenv("MONGO_PORT", 27017))
    MONGO_DB_USER: str = os.getenv("MONGO_DB_USER", "kubeblast")
    MONGO_DB_PASS: str = os.getenv("MONGO_DB_PASS", "kubeblast")
    MONGO_DB_NAME: str = os.getenv("MONGO_DB_NAME", "kubeblast")
    MONGO_URI: str = f"mongodb://{MONGO_DB_USER}:{MONGO_DB_PASS}@{MONGO_HOST}:{MONGO_PORT}/{MONGO_DB_NAME}"
 

    WORKER_WATCH_INTERVAL: int = int(os.getenv("WORKER_WATCH_INTERVAL", 3))

config = Config()