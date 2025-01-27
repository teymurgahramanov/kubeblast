from fastapi import HTTPException
from typing import Annotated
from api.core import models, password, db
from api.core.models import UserCreate

async def get_user(username: str):
    user = await db.mongo.users.find_one({"username": username})
    if user:
        return models.UserInDB(**user)
    else:
        return None

async def create_user(user: UserCreate):
    user_in_db = await get_user(user["username"])

    if user_in_db:
        return HTTPException(status_code=400, detail="Username already registered")

    print(user)
    user["hashed_password"] = password.hash_password(user.password)

    user_to_db = models.UserInDB(**user)

    result = await db.mongo.users.insert_one(user_to_db.dict())
    return result