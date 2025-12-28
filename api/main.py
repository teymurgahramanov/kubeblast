from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from routes import token, user_profile, jobs, logs, files, stats
from core.log import logger
from config import config
import uvicorn
import os
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
    from routes import jobs_extra, users
    app.include_router(jobs_extra.router, tags=["jobs_extra"])
    app.include_router(users.router, tags=["users"])

@app.on_event("startup")
async def start_capacity_warmer():
  stop_event = threading.Event()
  app.state.capacity_warm_stop_event = stop_event

  def _warm_loop():
    try:
      from services import capacity
      try:
        capacity.compute_and_store_capacity()
      except Exception as e:
        logger.warning(f"Initial capacity warm failed: {e}")
      interval = int(config.CAPACITY_WARM_INTERVAL)
      while not stop_event.wait(interval):
        try:
          capacity.compute_and_store_capacity()
        except Exception as e:
          logger.warning(f"Capacity warm failed: {e}")
    finally:
      pass

  t = threading.Thread(target=_warm_loop, name="capacity-warm", daemon=True)
  t.start()
  app.state.capacity_warm_thread = t

@app.on_event("shutdown")
async def stop_capacity_warmer():
  stop_event = getattr(app.state, "capacity_warm_stop_event", None)
  t = getattr(app.state, "capacity_warm_thread", None)
  if stop_event:
    stop_event.set()
  if t and t.is_alive():
    try:
      t.join(timeout=5)
    except Exception:
      pass

uvicorn.run(
  app,
  host="0.0.0.0",
  port=8000,
  log_config=None,
  access_log=False
)