from api.core import models, password, db

def get_users():
    users = db.mongo.users.find()
    return [models.User(**user) for user in users]

def get_user(username: str):
    user = db.mongo.users.find_one({"username": username})
    if user:
        return models.User(**user)
    else:
        return None

def create_user(user_data):
    user_in_db = get_user(user_data.username)

    if user_in_db:
        return user_in_db

    user_data_dict = user_data.dict()
    user_data_dict["hashed_password"] = password.hash_password(user_data.password)

    user_to_db = models.UserInDB(**user_data_dict)
    
    try:
        db.mongo.users.insert_one(user_to_db.dict())
    except Exception as e:
        return False
    else:
        return True

def update_user(username: str, user_data: dict):
    user_in_db = get_user(username)
    if not user_in_db:
        return None

    user_data = {key: value for key, value in user_data.items() if value not in [None, "", [], {}, ()]}
    if "password" in user_data:
        user_data["hashed_password"] = password.hash_password(user_data.pop("password"))

    try:
        db.mongo.users.update_one({"username": username}, {"$set": user_data})
    except Exception as e:
        return False
    else:
        updated_user = get_user(username)
        return updated_user

def delete_user(username: str):
    user_in_db = get_user(username)
    if not user_in_db:
        return None
    try:
        db.mongo.users.delete_one({"username": username})
    except Exception as e:
        return False
    else:
        return True