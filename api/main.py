from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from routes import token, user_profile, jobs, logs, files
from core.log import logger
from config import config
import uvicorn
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/dashboards", StaticFiles(directory=config.STORAGE_DIR), name="dashboards")

app.include_router(token.router,tags=["token"])
app.include_router(user_profile.router,tags=["profile"])
app.include_router(jobs.router,tags=["jobs"])
app.include_router(logs.router,tags=["logs"])
app.include_router(files.router,tags=["files"])

@app.on_event("startup")
async def initialize():

  if config.PRO_LICENSE_KEY and config.PRO_LICENSE_ID:
      from license_check import check_license
      if not check_license(config.PRO_LICENSE_ID, config.PRO_LICENSE_KEY):
          logger.error("Invalid license key. Continuing in community mode.")
          config.IS_PRO = False
      else:
          logger.info("License key is valid. Pro features enabled.")
          config.IS_PRO = True
  else:
      logger.info("License or account id not provided. Continuing in community mode.")
  
  try:
    from core import models, db
    from services import auth

    admin = auth.get_user("admin")
    if not admin:
        admin = models.UserInDB(
            username="admin", 
            hashed_password=auth.hash_password("admin"),
            role="admin",
        )
        db.mongo.users.insert_one(admin.dict())
        logger.info("Admin user created with password: admin")
  except Exception as e:
    logger.error(e)
    raise e

@app.on_event("startup")
async def load_pro_routes():
  if config.IS_PRO:
    from routes import jobs_extra, users
    app.include_router(jobs_extra.router, tags=["jobs_extra"])
    app.include_router(users.router, tags=["users"])

uvicorn.run(
  app,
  host="0.0.0.0",
  port=8000,
  log_config=None,
  access_log=False
)