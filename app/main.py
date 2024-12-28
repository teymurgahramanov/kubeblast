from fastapi import FastAPI
from app.routes import jmeter, logs, reports

app = FastAPI()

app.include_router(jmeter.router, prefix="/task", tags=["JMeter"])
app.include_router(logs.router, prefix="/logs", tags=["Logs"])
app.include_router(reports.router, prefix="/reports", tags=["Reports"])