<p align="center">
    <img src="assets/logo.svg" style="width: 70%; height: auto;" />
</p>
<p align="center">
    Kubernetes-native load testing platform
</p>

# Kubeblast
Kubeblast turns your Kubernetes cluster into a Load Testing platform, where running JMeter load tests is simple and efficient. No scripting, no setup — just run your tests and get results!

## ✨ Features
- __Simplicity First__ – Just upload your JMX file and click *Start*. That's it.
- __Intuitive UI__ – Manage jobs, view logs, and monitor execution in real-time.
- __Placement Control__ – Define which Kubernetes nodes to run workloads.
- __Resource Control__ – Set up requests and limits to fit your resource pool.
- __Storage Backends__ – Support for S3 (AWS, MinIO) and PVC.
- __Built-in RBAC__ – Role-based access control with support for Users, Admins, and Moderators.
- __Moderation Workflow__ – Assign moderators to review and approve JMX test plans before execution.
- __LDAP Support__ – Integrate with LDAP for centralized authentication and access management.

## ▶️ Quick start
1. Add Helm repository
   ```bash
   helm repo add teymurgahramanov https://teymurgahramanov.github.io/charts && helm repo update teymurgahramanov
   ```
2. Install Helm chart
   ```
   helm upgrade --install teymurgahramanov/kubeblast--set mongodb.enabled=true --namespace kubeblast --create-namespace
   ```
3. Access UI
   ```
   kubectl -n kubeblast port-forward svc/kubeblast -n argocd 8080:80
   ```

## ⭐ Pro Features
Kubeblast Pro unlocks advanced features, including __LDAP__ authentication and __role-based access control (RBAC)__ and Moderation Workflow.
To request access to the Pro edition, contact me at teymur_gahramanov@outlook.com.

## ⚙️ Configuration
All parameters are configurable via environment variables.
You can define them directly using Helm values or store in a Kubernetes Secret.

Below is the list of supported environment variables:

| Environment Variable | Type | Description | Default Value | Example |
|---------------------|------|-------------|---------------|---------|
| `PRO_LICENSE_KEY` | string | License key for enabling Pro features | | |
| `PRO_LICENSE_ID` | string | License ID for enabling Pro features | | |
| `LOG_LEVEL` | string | Logging level | `INFO` | `DEBUG`, `INFO`, `WARNING`, `ERROR` |
| `SECRET_KEY` | string | Secret key for JWT tokens and encryption | Random string | `your-secret-key` |
| `PER_USER_CURRENT_JOBS_LIMIT` | int | Maximum number of current jobs per user | `3` |  |
| `MONGO_HOST` | string | MongoDB host address | `localhost` | |
| `MONGO_PORT` | int | MongoDB port number | `27017` | |
| `MONGO_DB_USER` | string | MongoDB username | `kubeblast` | |
| `MONGO_DB_PASS` | string | MongoDB password | `kubeblast` | |
| `MONGO_DB_NAME` | string | MongoDB database name | `kubeblast` | |
| `STORAGE_BACKEND` | string | Storage backend type | `fs` | `fs`, `s3` |
| `S3_URL` | string | Endpoint URL of S3 compatible storage | - | |
| `S3_ACCESS_KEY` | string | S3 access key | - | |
| `S3_SECRET_KEY` | string | S3 secret key | - | |
| `S3_REGION` | string | S3 region (If required) | `us-east-1` | |
| `S3_BUCKET` | string | S3 bucket name | - | |
| `K8S_JOB_IMAGE` | string | JMeter Docker image for load testing | `alpine/jmeter:5.6` | |
| `K8S_JOB_HELPER_IMAGE_S3` | string | Helper image for S3 operations | `amazon/aws-cli:2.27.12` | |
| `K8S_JOB_HELPER_IMAGE_FS` | string | Helper image for filesystem operations | `alpine:3.18` | |
| `K8S_JOB_IMAGE_PULL_POLICY` | string | Image pull policy for Kubernetes jobs | `IfNotPresent` | `Always`, `Never` |
| `K8S_JOB_IMAGE_PULL_SECRETS` | JSON | Image pull secrets (JSON array) | `[]` | `[{"name": "regcred"}]` |
| `K8S_JOB_NODE_SELECTOR` | JSON | Node selector for job placement (JSON) | `{}` | `{"nodeType": "worker"}` |
| `K8S_JOB_TOLERATIONS` | JSON | Tolerations for job scheduling (JSON array) | `[]` | `[{"key": "dedicated", "operator": "Equal", "value": "loadtest", "effect": "NoSchedule"}]` |
| `K8S_JOB_RESOURCES` | JSON | Resource requests/limits (JSON) | `{}` | `{"requests": {"cpu": "500m", "memory": "1Gi"}, "limits": {"cpu": "2", "memory": "4Gi"}}` |
| `LDAP_ENABLED` | bool | Enable LDAP authentication | `false` | |
| `LDAP_SERVER` | string | LDAP server address | - | `ldap://ldap.example.com:389` |
| `LDAP_BASE_DN` | string | LDAP base distinguished name | - | `DC=example,DC=com` |
| `LDAP_BIND_DN` | string | LDAP bind distinguished name | - | `CN=admin,DC=example,DC=com` |
| `LDAP_BIND_PASSWORD` | string | LDAP bind password | - | |
| `LDAP_USER_SEARCH_FILTER` | string | LDAP user search filter | `(&(objectClass=person)(sAMAccountName={username}))` | `(&(objectClass=user)(uid={username}))` |
| `LDAP_GROUP_SEARCH_FILTER` | string | LDAP group search filter | `(&(objectClass=group)(member={dn}))` | `(&(objectClass=groupOfNames)(member={dn}))` |
| `LDAP_USER_ATTRIBUTES` | string | Comma-separated user attributes | `uid,sAMAccountName,cn,mail,memberOf` | `uid,cn,mail,displayName` |
| `LDAP_GROUP_ATTRIBUTES` | string | Comma-separated group attributes | `cn,member` | `cn,memberUid` |
| `LDAP_USE_TLS` | bool | Use TLS for LDAP connection | `false` | |
| `LDAP_VERIFY_CERT` | bool | Verify LDAP server certificate | `false` | |

