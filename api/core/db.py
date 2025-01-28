from api.core.config import config
from pymongo import MongoClient

MONGO_URI = config.MONGO_URI
MONGO_DB_NAME = config.MONGO_DB_NAME

client = MongoClient(MONGO_URI)
mongo = client.get_database(MONGO_DB_NAME)