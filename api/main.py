from fastapi import FastAPI
from api.routers import jobs, logs, reports

app = FastAPI()

app.include_router(jobs.router,tags=["jobs"])
app.include_router(logs.router,tags=["logs"])
app.include_router(reports.router,tags=["reports"])