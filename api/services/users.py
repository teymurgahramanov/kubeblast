from api.core import models, password, db
from fastapi import HTTPException, Response

def get_users():
    users = db.mongo.users.find()
    return [models.User(**user) for user in users]

def get_user(username: str):
    user = db.mongo.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    else:
        return models.User(**user)

def create_user(user_data):
    user = get_user(user_data.username)
    if user:
        raise HTTPException(status_code=400, detail="User already exists")

    user_data_dict = user_data.dict()
    user_data_dict["hashed_password"] = password.hash_password(user_data.password)
    user

    user_to_db = models.UserInDB(**user_data_dict)
    
    db.mongo.users.insert_one(user_to_db.dict())

    return get_user(user_data.username)

def update_user(username: str, user_data: dict):
    user = get_user(username)

    user_data = {key: value for key, value in user_data.items() if value not in [None, "", [], {}, ()]}
    if "password" in user_data:
        user_data["hashed_password"] = password.hash_password(user_data.pop("password"))

    db.mongo.users.update_one({"username": username}, {"$set": user_data})
    return get_user(username)

def delete_user(username: str):
    user = get_user(username)
    db.mongo.users.delete_one({"username": username})
    return Response(status_code=204, content={f"Job {username} deleted"})