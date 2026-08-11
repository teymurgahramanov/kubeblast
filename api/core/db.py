from config import config
from pymongo import MongoClient

MONGODB_URI = config.MONGODB_URI
MONGODB_NAME = config.MONGODB_NAME

client = MongoClient(MONGODB_URI)
mongo = client.get_database(MONGODB_NAME)


def ensure_indexes():
    indexes = [
        (["created_at"], [("created_at", -1)], "jobs_created_at"),
        (["owner", "created_at"], [("owner", 1), ("created_at", -1)], "jobs_owner_created_at"),
        (["status", "created_at"], [("status", 1), ("created_at", -1)], "jobs_status_created_at"),
        (
            ["owner", "status", "created_at"],
            [("owner", 1), ("status", 1), ("created_at", -1)],
            "jobs_owner_status_created_at",
        ),
    ]
    existing = {
        tuple(field for field, _direction in info["key"])
        for info in mongo.jobs.index_information().values()
    }
    for fields, keys, name in indexes:
        if tuple(fields) not in existing:
            mongo.jobs.create_index(keys, name=name)
