from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from routes import token, user_profile, jobs, logs, events, files, stats
from core.log import logger
from config import config
import uvicorn
import time
import threading

app = FastAPI(
    title="Kubeblast",
    description="Kubernetes-native load testing platform",
    version=config.APP_VERSION,
    openapi_url="/api/v1/openapi.json"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(token.router,tags=["token"])
app.include_router(user_profile.router,tags=["profile"])
app.include_router(jobs.router,tags=["jobs"])
app.include_router(logs.router,tags=["logs"])
app.include_router(events.router,tags=["events"])
app.include_router(files.router,tags=["files"])
app.include_router(stats.router,tags=["stats"])

@app.on_event("startup")
async def initialize():

  if config.LICENSE_KEY and config.LICENSE_ID:
      from license_check import check_license
      if not check_license(config.LICENSE_ID, config.LICENSE_KEY):
          logger.error("Invalid license key. Continuing in community mode.")
          config.LICENSE_VALID = False
      else:
          logger.info("License key is valid. Advanced features enabled.")
          config.LICENSE_VALID = True
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
  if config.LICENSE_VALID:
    from routes import jobs_extra, users, oidc, pats
    app.include_router(jobs_extra.router, tags=["jobs_extra"])
    app.include_router(users.router, tags=["users"])
    app.include_router(oidc.router, tags=["oidc"])
    app.include_router(pats.router, tags=["pats"])

@app.on_event("startup")
async def start_capacity_worker():
  from services import capacity

  def loop():
    interval = int(config.CAPACITY_WARM_INTERVAL)
    while True:
      try:
        capacity.compute_and_store_capacity()
      except Exception as e:
        logger.warning(f"Capacity update failed: {e}")
      time.sleep(interval)

  threading.Thread(target=loop, daemon=True).start()

_job_status_worker_started = False

@app.on_event("startup")
async def start_job_status_worker():
  """
  Starts the Kubernetes->Mongo job status sync loop inside the API process.
  Always enabled.
  """
  global _job_status_worker_started

  if _job_status_worker_started:
    return

  def loop():
    try:
      from worker import process_job_update
      process_job_update()
    except Exception as e:
      # In daemon thread; just log and let supervisor restart the container if needed
      logger.error(f"Job status worker crashed: {e}")

  threading.Thread(target=loop, daemon=True).start()
  _job_status_worker_started = True


uvicorn.run(
  app,
  host="0.0.0.0",
  port=8000,
  log_config=None,
  access_log=False
)