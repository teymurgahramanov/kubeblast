from fastapi import FastAPI
from api.endpoints import jobs, logs, reports, auth, users

app = FastAPI()

@app.on_event("startup")
async def create_admin():
  from api.services.users import create_user
  user_data = {"username": "admin", "password": "admin", "role": "admin"}
  await create_user(**user_data)

app.include_router(auth.router,tags=["auth"])
app.include_router(users.router,tags=["users"])
app.include_router(jobs.router,tags=["jobs"])
app.include_router(logs.router,tags=["logs"])
app.include_router(reports.router,tags=["reports"])