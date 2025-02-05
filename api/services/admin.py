from api.services.auth import get_user
from api.core import models, password, db, config

def create_admin_user():
    admin = get_user("admin")
    if not admin:
        admin = models.UserInDB(
            username=config.ADMIN_USERNAME, 
            hashed_password=password.hash_password(config.ADMIN_PASSWORD),
            role="admin"
        )
        db.mongo.users.insert_one(admin.dict())