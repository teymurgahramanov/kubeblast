from core import models, db
from services import auth
from fastapi import HTTPException

def get_profile(username: str):
    user = db.mongo.users.find_one({"username": username})
    return models.User(**user)

def update_profile(username: str, user_data: dict):
    user = get_profile(username).dict()
    if user["method"] == "local":
      user_data = {key: value for key, value in user_data.items() if value not in [None, "", [], {}, ()]}
      if "password" in user_data:
          user_data["hashed_password"] = auth.hash_password(user_data.pop("password"))
      db.mongo.users.update_one({"username": username}, {"$set": user_data})
      return get_profile(username)
    else:
      raise HTTPException(status_code=400, detail="Can't update external user")


