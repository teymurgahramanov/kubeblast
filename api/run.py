# run.py
import uvicorn
from main import app

# Start uvicorn without default logs
uvicorn.run(
    app,
    host="0.0.0.0",
    port=8000,
    log_config=None,  # ✅ Disable default Uvicorn log config
    access_log=False  # ✅ Disable access logs
)