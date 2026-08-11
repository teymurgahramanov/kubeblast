import importlib
import sys
import threading
import time
from contextlib import asynccontextmanager

import uvicorn
from config import config
from core.log import logger
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import events, files, jobs, logs, metrics, stats, token, user_profile

_advanced_routes_registered = False


def _sync_startup_initialize():
    global _advanced_routes_registered

    from core import db, models
    from services import auth

    try:
        db.ensure_indexes()
    except Exception as e:  # noqa: BLE001
        logger.warning(f"MongoDB index initialization failed: {e}")

    try:
        admin = auth.get_user("admin")
        if not admin:
            admin = models.UserInDB(
                username="admin",
                full_name="Administrator",
                hashed_password=auth.hash_password("admin"),
                role="admin",
            )
            db.mongo.users.insert_one(admin.dict())
            logger.info("Admin user created with password: admin")
    except Exception as e:  # noqa: BLE001
        logger.error(f"Admin bootstrap failed: {e}")
        sys.exit(1)

    if config.LICENSE_FILE:
        try:
            license_module = importlib.import_module("license_check")
            check_license = license_module.check_license
            require_valid_license = license_module.require_valid_license
        except (AttributeError, ImportError) as e:
            logger.warning(
                f"Unable to verify license: ({type(e).__name__}). "
                "Continuing in community mode."
            )
            config.LICENSE_VALID = False
            return

        try:
            result = check_license(config.LICENSE_FILE)
        except Exception as e:  # noqa: BLE001
            logger.warning(
                f"License check crashed: ({type(e).__name__}). "
                "Continuing in community mode."
            )
            config.LICENSE_VALID = False
            return

        if result.valid:
            logger.info("License is valid. Advanced features enabled.")
            config.LICENSE_VALID = True
            if not _advanced_routes_registered:
                from routes import jobs_extra, oidc, pats, users

                license_dependency = [Depends(require_valid_license)]
                app.include_router(
                    jobs_extra.router,
                    tags=["jobs_extra"],
                    dependencies=license_dependency,
                )
                app.include_router(
                    users.router,
                    tags=["users"],
                    dependencies=license_dependency,
                )
                app.include_router(
                    oidc.router,
                    tags=["oidc"],
                    dependencies=license_dependency,
                )
                app.include_router(
                    pats.router,
                    tags=["pats"],
                    dependencies=license_dependency,
                )
                _advanced_routes_registered = True
            return

        logger.error(
            f"License is invalid: {result.reason}. "
            "Continuing in community mode."
        )
        config.LICENSE_VALID = False
    else:
        logger.info("License not provided. Continuing in community mode.")
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
        except Exception as e:
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
