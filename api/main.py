import importlib
import sys
import threading
import time
from contextlib import asynccontextmanager

import uvicorn
from config import config
from core.log import logger
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import events, files, jobs, logs, metrics, stats, token, user_profile


def _sync_startup_initialize():
    from core import db, models
    from services import auth

    try:
        admin = auth.get_user("admin")
        if not admin:
            admin = models.UserInDB(
                username="admin",
                hashed_password=auth.hash_password("admin"),
                role="admin",
            )
            db.mongo.users.insert_one(admin.dict())
            logger.info("Admin user created with password: admin")
    except Exception as e:  # noqa: BLE001
        logger.error(f"Admin bootstrap failed: {e}")
        sys.exit(1)
        
    if config.LICENSE_KEY and config.LICENSE_ID:
        try:
            check_license = importlib.import_module("license_check").check_license
            if not check_license(config.LICENSE_ID, config.LICENSE_KEY):
                logger.error("Invalid license key. Continuing in community mode.")
                config.LICENSE_VALID = False
            else:
                logger.info("License key is valid. Advanced features enabled.")
                config.LICENSE_VALID = True
                from routes import jobs_extra, oidc, pats, users
                app.include_router(jobs_extra.router, tags=["jobs_extra"])
                app.include_router(users.router, tags=["users"])
                app.include_router(oidc.router, tags=["oidc"])
                app.include_router(pats.router, tags=["pats"])
        except Exception as e:  # noqa: BLE001
            logger.warning(f"license_check failed: {e}. Continuing in community mode.")
            config.LICENSE_VALID = False
    else:
        logger.info("License or account id not provided. Continuing in community mode.")
        config.LICENSE_VALID = False

_job_status_worker_started = False

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _job_status_worker_started

    _sync_startup_initialize()

    from services import capacity

    def capacity_loop():
        time.sleep(max(0, int(config.STARTUP_CAPACITY_STAGGER_S)))
        interval = int(config.CAPACITY_WARM_INTERVAL)
        while True:
            try:
                capacity.compute_and_store_capacity()
            except Exception as e:  # noqa: BLE001
                logger.warning(f"Capacity update failed: {e}")
            time.sleep(interval)

    threading.Thread(target=capacity_loop, daemon=True).start()

    def worker_loop():
        time.sleep(max(0, int(config.STARTUP_WORKER_STAGGER_S)))
        try:
            from worker import process_job_update
            process_job_update()
        except Exception as e:  # noqa: BLE001
            logger.error(f"Job status worker crashed: {e}")

    if not _job_status_worker_started:
        threading.Thread(target=worker_loop, daemon=True).start()
        _job_status_worker_started = True

    yield


app = FastAPI(
    title="Kubeblast",
    description="Kubernetes-native load testing platform",
    version=config.APP_VERSION,
    openapi_url="/api/v1/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(token.router, tags=["token"])
app.include_router(user_profile.router, tags=["profile"])
app.include_router(jobs.router, tags=["jobs"])
app.include_router(logs.router, tags=["logs"])
app.include_router(events.router, tags=["events"])
app.include_router(files.router, tags=["files"])
app.include_router(stats.router, tags=["stats"])
app.include_router(metrics.router, tags=["metrics"])

uvicorn.run(
    app,
    host="0.0.0.0",
    port=8000,
    log_config=None,
    access_log=False,
)
