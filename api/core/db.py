from api.core.config import config
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URI = config.MONGO_URI
MONGO_DB_NAME = config.MONGO_DB_NAME

client = AsyncIOMotorClient(MONGO_URI)
mongo = client[MONGO_DB_NAME]