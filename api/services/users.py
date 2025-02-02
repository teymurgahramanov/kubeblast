from api.core import models, password, db
from fastapi import HTTPException

def get_users():
    users = db.mongo.users.find()
    return [models.User(**user) for user in users]

def get_user(username: str):
    user = db.mongo.users.find_one({"username": username})
    if user:
        return models.User(**user)
    else:
        return HTTPException(status_code=404, detail="User not found")

def create_user(user_data):
    user = get_user(user_data.username)
    if user:
        return HTTPException(status_code=400, detail="User already exists")

    user_data_dict = user_data.dict()
    user_data_dict["hashed_password"] = password.hash_password(user_data.password)

    user_to_db = models.UserInDB(**user_data_dict)
    
    try:
        db.mongo.users.insert_one(user_to_db.dict())
    except Exception as e:
        print(e)
        return HTTPException(status_code=500, detail="Error creating user")
    else:
        return True

def update_user(username: str, user_data: dict):
    user = get_user(username)
    if not user:
        return HTTPException(status_code=404, detail="User not found")

    user_data = {key: value for key, value in user_data.items() if value not in [None, "", [], {}, ()]}
    if "password" in user_data:
        user_data["hashed_password"] = password.hash_password(user_data.pop("password"))

    try:
        db.mongo.users.update_one({"username": username}, {"$set": user_data})
    except Exception as e:
        print(e)
        return HTTPException(status_code=500, detail="Error updating user")
    else:
        return True

def delete_user(username: str):
    user = get_user(username)
    if not user:
        return HTTPException (status_code=404, detail="User not found")
    try:
        db.mongo.users.delete_one({"username": username})
    except Exception as e:
        print(e)
        return HTTPException(status_code=500, detail="Error deleting user")
    else:
        return True