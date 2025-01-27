from fastapi import HTTPException
from api.core.security import hash_password
from api.core import models
from api.core.db import db

async def create_user(user: dict):

    print ("aaa")
    user_data = await get_user(user["username"])
    print (user_data)
    if user_data:
        return HTTPException(status_code=400, detail="Username already registered")

    hashed_password = hash_password(user_data.password)

    user_data["hashed_password"] = hashed_password

    user_data_db = models.UserInDB(**user_data)

    result = await db.users.insert_one(user_data_db.dict())
    return result