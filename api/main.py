from fastapi import FastAPI
from api.routers import jobs, logs, reports, auth, users

app = FastAPI()

app.include_router(auth.router,tags=["auth"])
app.include_router(users.router,tags=["users"])
app.include_router(jobs.router,tags=["jobs"])
app.include_router(logs.router,tags=["logs"])
app.include_router(reports.router,tags=["reports"])