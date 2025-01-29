from fastapi import FastAPI
from api.endpoints import auth, users, profile, jobs, logs

app = FastAPI()

@app.on_event("startup")
async def initialize():
  from api.core import auth, config
  import os
  try:
    os.makedirs(config.UPLOAD_DIR, exist_ok=True)
    auth.create_admin_user()
  except Exception as e:
    print(f"ERROR: {str(e)}")
    return False
  else:
    return True

app.include_router(auth.router,tags=["auth"])
app.include_router(users.router,tags=["users"])
app.include_router(profile.router,tags=["profile"])
app.include_router(jobs.router,tags=["jobs"])
app.include_router(logs.router,tags=["logs"])