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
    from api.core import config, models, password, db
    from api.services import auth
    from kubernetes import client, config as k8s_config

    # Create admin user
    admin = auth.get_user("admin")
    if not admin:
        admin = models.UserInDB(
            username=config.config.ADMIN_USERNAME, 
            hashed_password=password.hash_password(config.config.ADMIN_PASSWORD),
            role="admin"
        )
        db.mongo.users.insert_one(admin.dict())

    # Create ResourceQuota for Pod limit
    k8s_config.load_incluster_config()
    namespace = config.config.K8S_NAMESPACE
    quota_name = "pod-limit"
    quota_spec = client.V1ResourceQuotaSpec(
        hard={"pods": config.config.K8S_NAMESPACE_QUOTA_POD_LIMIT}
    )

    try:
        existing_quota = client.CoreV1Api().read_namespaced_resource_quota(name=quota_name, namespace=namespace)
        existing_quota.spec = quota_spec
        client.CoreV1Api().replace_namespaced_resource_quota(name=quota_name, namespace=namespace, body=existing_quota)
        print(f"Updated existing ResourceQuota '{quota_name}' in namespace '{namespace}'.")
    except client.exceptions.ApiException as e:
        if e.status == 404:
            new_quota = client.V1ResourceQuota(
                metadata=client.V1ObjectMeta(name=quota_name),
                spec=quota_spec
            )
            client.CoreV1Api().create_namespaced_resource_quota(namespace=namespace, body=new_quota)
            print(f"Created new ResourceQuota '{quota_name}' in namespace '{namespace}'.")
        else:
            print(f"Failed to create/update ResourceQuota: {e}")
  except Exception as e:
     print(e)
     exit(1)

app.include_router(token.router,tags=["token"])
app.include_router(users.router,tags=["users"])
app.include_router(jobs.router,tags=["jobs"])
app.include_router(logs.router,tags=["logs"])
app.include_router(files.router,tags=["files"])