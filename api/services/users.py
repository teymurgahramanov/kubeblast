from fastapi import HTTPException
from api.core.security import pwd_context
from api.core import models
from api.core.db import db

async def create_user(user: models.UserCreate):
  if await db.users.find_one({"username": user.username}):
      raise HTTPException(status_code=400, detail="Username already registered")
  if await db.users.find_one({"email": user.email}):
      raise HTTPException(status_code=400, detail="Email already registered")

  hashed_password = pwd_context.hash(user.password)

  user_data = user.dict()
  user_data["hashed_password"] = hashed_password

  user_data_db = models.UserInDB(**user_data)

  result = await db.users.insert_one(user_data_db.dict())
  return result

async def create_admin_user():
  admin_user = {
      "username": "admin",
      "password": "admin",
      "role": "admin"
  }
  print("Aaa")
  admin_user = await db.users.find_one({"username": "admin"})
  print("bbb")
  if not admin_user:
      create_user(models.UserCreate(**admin_user))
      print("Admin user created")
  else:
      print("Admin user already exists")