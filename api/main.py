from fastapi import FastAPI
from api.endpoints import jobs, logs, reports, auth, users, profile

app = FastAPI()

@app.on_event("startup")
async def create_admin():
  from api.core import security
  return security.create_admin_user()

app.include_router(auth.router,tags=["auth"])
app.include_router(users.router,tags=["users"])
app.include_router(jobs.router,tags=["jobs"])
app.include_router(logs.router,tags=["logs"])
app.include_router(reports.router,tags=["reports"])
app.include_router(profile.router,tags=["profile"])