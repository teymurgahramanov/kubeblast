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
        result = db.mongo.users.insert_one(user_to_db.dict())
    except Exception as e:
        return False
    finally:
        return True

def update_user(username: str, update_data: dict):
    if "password" in update_data:
        update_data["hashed_password"] = password.hash_password(update_data.pop("password"))

    result = db.mongo.users.update_one({"username": username}, {"$set": update_data})

    if result.matched_count == 0:
            raise Exception(f"Failed to update user '{username}'. No matching user found.")

    updated_user = get_user(username)
    return updated_user

def delete_user(username: str):
    result = db.mongo.users.delete_one({"username": username})
    return result