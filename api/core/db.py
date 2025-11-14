from config import config
from pymongo import MongoClient

MONGODB_URI = config.MONGODB_URI
MONGODB_NAME = config.MONGODB_NAME

client = MongoClient(MONGODB_URI)
mongo = client.get_database(MONGODB_NAME)