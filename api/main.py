from api.services import admin
from fastapi import FastAPI
from api.endpoints import token, users, jobs, logs, files

app = FastAPI()

@app.on_event("startup")
async def initialize():
  from api.core import config
  import os
  os.makedirs(config.config.UPLOAD_DIR, exist_ok=True)
  return admin.create_admin_user()

app.include_router(token.router,tags=["token"])
app.include_router(users.router,tags=["users"])
app.include_router(jobs.router,tags=["jobs"])
app.include_router(logs.router,tags=["logs"])
app.include_router(files.router,tags=["files"])