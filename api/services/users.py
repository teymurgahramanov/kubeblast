from core import models, db
from services import auth
from fastapi import HTTPException

def get_users():
    users = db.mongo.users.find()
    return [models.User(**user) for user in users]

def get_user(username: str, current_user=None):
    if current_user and current_user.role != "admin":
        username = current_user.username
    user = db.mongo.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    else:
        return models.User(**user)

def create_user(user_data):
    user = db.mongo.users.find_one({"username": user_data.username})
    if user:
        raise HTTPException(status_code=400, detail="User already exists")

    user_data_dict = user_data.dict()
    user_data_dict["hashed_password"] = auth.hash_password(user_data.password)

    user_to_db = models.UserInDB(**user_data_dict)
    
    db.mongo.users.insert_one(user_to_db.dict())

    return get_user(user_data.username)

def update_user(username: str, user_data: dict):
    user = get_user(username)

    user_data = {key: value for key, value in user_data.items() if value not in [None, "", [], {}, ()]}
    if "password" in user_data:
        user_data["hashed_password"] = auth.hash_password(user_data.pop("password"))

    db.mongo.users.update_one({"username": username}, {"$set": user_data})
    return get_user(username)

def delete_user(username: str):
    user = get_user(username)
    db.mongo.users.delete_one({"username": username})
    return {f"User {username} deleted"}