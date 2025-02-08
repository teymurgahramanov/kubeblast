from fastapi import FastAPI
from api.endpoints import token, users, jobs, logs, files

app = FastAPI()

@app.on_event("startup")
async def initialize():
  try:
    from api.core import config, models, password, db
    from api.services import auth
    import os
    admin = auth.get_user("admin")
    if not admin:
        admin = models.UserInDB(
            username=config.ADMIN_USERNAME, 
            hashed_password=password.hash_password(config.ADMIN_PASSWORD),
            role="admin"
        )
        db.mongo.users.insert_one(admin.dict())
    os.makedirs(config.config.PLAN_DIR, exist_ok=True)
    os.makedirs(config.config.REPORT_DIR, exist_ok=True)
  except Exception as e:
     print(e)
     exit(1)

app.include_router(token.router,tags=["token"])
app.include_router(users.router,tags=["users"])
app.include_router(jobs.router,tags=["jobs"])
app.include_router(logs.router,tags=["logs"])
app.include_router(files.router,tags=["files"])