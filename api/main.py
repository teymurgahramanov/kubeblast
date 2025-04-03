from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import token, user_profile, jobs, logs, files
from core.log import logger
from config import config

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def initialize():
  try:
    from core import models, db
    from services import auth

    # Create admin user
    admin = auth.get_user("admin")
    if not admin:
        admin = models.UserInDB(
            username="admin", 
            hashed_password=auth.hash_password("admin"),
            role="admin"
        )
        db.mongo.users.insert_one(admin.dict())
  except Exception as e:
     logger.error(e)
     exit(1)

app.include_router(token.router,tags=["token"])
app.include_router(user_profile.router,tags=["profile"])
app.include_router(jobs.router,tags=["jobs"])
app.include_router(logs.router,tags=["logs"])
app.include_router(files.router,tags=["files"])

if config.IS_PRO:
    from routes import jobs_extra, users
    app.include_router(jobs_extra.router,tags=["jobs_extra"])
    app.include_router(users.router,tags=["users"])