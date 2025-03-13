from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routes import token, users, jobs, logs, files

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def initialize():
  try:
    from api.core import models, password, db
    from api.services import auth

    # Create admin user
    admin = auth.get_user("admin")
    if not admin:
        admin = models.UserInDB(
            username="admin", 
            hashed_password=password.hash_password("admin"),
            role="admin"
        )
        db.mongo.users.insert_one(admin.dict())
  except Exception as e:
     print(e)
     exit(1)

app.include_router(token.router,tags=["token"])
app.include_router(users.router,tags=["users"])
app.include_router(jobs.router,tags=["jobs"])
app.include_router(logs.router,tags=["logs"])
app.include_router(files.router,tags=["files"])