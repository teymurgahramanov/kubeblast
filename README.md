<p align="center">
    <img src="assets/logo.svg" style="width: 70%; height: auto;" />
</p>
<p align="center">
    Kubernetes-native load testing platform
</p>

# Kubeblast
Kubeblast turns your Kubernetes cluster into a collaborative Load Testing platform, where running JMeter load tests is simple and efficient. It offers a simple *click-and-run* workflow, built-in RBAC with moderator approval, full flexibility, and an lightweight open-source footprint.

## 💡 Example Use-Cases

### 1. **Self-Service Load Testing**
* **Problem** – Developers and QA teams often depend on Ops engineers to prepare JMeter environments or end up running tests locally. This causes delays, inconsistent setups, and slows the delivery pipeline.  
* **Solution** – Kubeblast lets users run Load Test scenarios with a few clicks, monitor execution, and instantly access results, enabling a true self-service experience.

### 2. **Leveraging Spare Cluster Capacity**
* **Problem** – You need to run load tests but want to avoid extra infrastructure costs or impacting production workloads.  
* **Solution** – Kubeblast provides fine-grained placement control and resource limits, allowing teams to use idle cluster capacity safely and efficiently—without disrupting core applications.

### 3. **Load Test Scenario Moderation**
* **Problem** – An unreviewed load test can overwhelm production, exceed quotas, or unintentionally (or intentionally) disrupt other workloads.  
* **Solution** – Kubeblast introduces moderator roles through RBAC. Every new test plan can be reviewed and approved before execution, ensuring safe, compliant, and controlled load testing.

## ✨ Features
- __Simplicity First__ – Just upload your existing Load Test scenario and click *Start*. That's it.
- __Intuitive UI__ – Manage jobs, view logs, and monitor execution in real-time.
- __Placement Control__ – Define which Kubernetes nodes to run workloads.
- __Resource Control__ – Size it to fit your resource pool.

## ⭐ Advanced Features
__Kubeblast Advanced__ unlocks more features:
- __Built-in RBAC__ – Role-based access control with support for Users, Admins, and Moderators.
- __Moderation Workflow__ – Assign moderators to review and approve Load Test scenarios before execution.
- __LDAP Support__ – Seamlessly integrate with your LDAP directory for centralized authentication and controlled access management.
- __OIDC Support__ –  Connect to any OIDC provider to enable secure, centralized authentication and streamlined access control.

To request access to the **Advanced** edition, contact me at teymur_gahramanov@outlook.com.

## ▶️ Quick start
1. Add Helm repository
   ```bash
   helm repo add teymurgahramanov https://teymurgahramanov.github.io/charts && helm repo update teymurgahramanov
   ```
2. Install Helm chart
   ```
   helm upgrade --install kubeblast teymurgahramanov/kubeblast \
      --set mongodb.enabled=true \
      --namespace kubeblast \
      --create-namespace 
   ```
3. Access UI on http://localhost:8080 using username `admin` and password `admin`. You can use [test.jmx](./test.jmx) for testing.
   ```
   kubectl -n kubeblast port-forward svc/kubeblast 8080:80
   ```

## ⚙️ Configuration
All parameters are configurable via environment variables.
You can define them directly using Helm values or store in a Kubernetes Secret.

Below is the list of supported environment variables:

| Environment Variable | Type | Description | Default Value | Example |
|---------------------|------|-------------|---------------|---------|
| `LICENSE_KEY` | string | License key for enabling Pro features |  |  |
| `LICENSE_ID` | string | License ID for enabling Pro features |  |  |
| `LOG_LEVEL` | string | Logging level | `INFO` | `DEBUG`, `INFO`, `WARNING`, `ERROR` |
| `SECRET_KEY` | string | Secret key for JWT tokens and encryption | Random string | `your-secret-key` |
| `PER_USER_CURRENT_JOBS_LIMIT` | int | Maximum number of current jobs per user | `3` |  |
| `MONGODB_HOST` | string | MongoDB host address | `localhost` |  |
| `MONGODB_PORT` | int | MongoDB port number | `27017` |  |
| `MONGODB_USER` | string | MongoDB username | `kubeblast` |  |
| `MONGODB_PASS` | string | MongoDB password | `kubeblast` |  |
| `MONGODB_NAME` | string | MongoDB database name | `kubeblast` |  |
| `MONGODB_PARAMS` | string | Extra MongoDB URI params appended to connection string | `""` | `?authSource=admin` |
| `STORAGE_PVC_NAME` | string | Name of PVC to mount for storage |  | `kubeblast-storage` |
| `K8S_JOB_PRIORITY_CLASS` | string | Kubernetes priority class for job pods |  |  |
| `K8S_JOB_IMAGE` | string | JMeter Docker image for load testing | `alpine/jmeter:5.6` | |
| `K8S_JOB_IMAGE_PULL_POLICY` | string | Image pull policy for Kubernetes jobs | `IfNotPresent` | `Always`, `Never` |
| `K8S_JOB_IMAGE_PULL_SECRETS` | JSON | Image pull secrets (JSON array) | `[]` | `[{"name": "regcred"}]` |
| `K8S_JOB_NODE_SELECTOR` | JSON | Node selector for job placement (JSON) | `{}` | `{"nodeType": "worker"}` |
| `K8S_JOB_TOLERATIONS` | JSON | Tolerations for job scheduling (JSON array) | `[]` | `[{"key": "dedicated", "operator": "Equal", "value": "loadtest", "effect": "NoSchedule"}]` |
| `K8S_JOB_RESOURCES` | JSON | Resource requests/limits (JSON) | `{}` | `{"requests": {"cpu": "500m", "memory": "1Gi"}, "limits": {"cpu": "2", "memory": "4Gi"}}` |
| `LDAP_ENABLED` | bool | Enable LDAP authentication | `false` |  |
| `LDAP_SERVER` | string | LDAP server address |  | `ldap://ldap.example.com:389` |
| `LDAP_BASE_DN` | string | LDAP base distinguished name |  | `DC=example,DC=com` |
| `LDAP_BIND_DN` | string | LDAP bind distinguished name |  | `CN=admin,DC=example,DC=com` |
| `LDAP_BIND_PASSWORD` | string | LDAP bind password |  |  |
| `LDAP_USER_SEARCH_FILTER` | string | LDAP user search filter | `(&(objectClass=person)(sAMAccountName={username}))` | `(&(objectClass=user)(uid={username}))` |
| `LDAP_GROUP_SEARCH_FILTER` | string | LDAP group search filter | `(&(objectClass=group)(member={dn}))` | `(&(objectClass=groupOfNames)(member={dn}))` |
| `LDAP_USER_ATTRIBUTES` | string | Comma-separated user attributes | `uid,sAMAccountName,cn,mail,memberOf` | `uid,cn,mail,displayName` |
| `LDAP_GROUP_ATTRIBUTES` | string | Comma-separated group attributes | `cn,member` | `cn,memberUid` |
| `LDAP_USE_TLS` | bool | Use TLS for LDAP connection | `false` | |
| `LDAP_VERIFY_CERT` | bool | Verify LDAP server certificate | `false` | |
| `OIDC_ENABLED` | bool | Enable OIDC authentication | `false` |  |
| `OIDC_CLIENT_ID` | string | OIDC client ID |  |  |
| `OIDC_CLIENT_SECRET` | string | OIDC client secret |  |  |
| `OIDC_REDIRECT_URI` | string | Redirect URI for frontend | `http://localhost:3000/login` |  |
| `OIDC_AUTH_URL` | string | OIDC authorization endpoint |  |  |
| `OIDC_TOKEN_URL` | string | OIDC token endpoint |  |  |
| `OIDC_USERINFO_URL` | string | OIDC userinfo endpoint |  |  |
| `OIDC_SCOPES` | string | Space-separated scopes | `openid profile email` | `openid profile email` |
| `OIDC_ROLE_MAPPING` | JSON | Map claims to RBAC roles | `{}` | `{"realm_admin":"admin","myclient:editor":"moderator","/groups/devops":"moderator","@corp.com":"user"}` |
| `OIDC_DEFAULT_ROLE` | string | Default RBAC role when no mapping matches | `user` |  |
| `OIDC_AUTO_CREATE_USERS` | bool | Auto-create users on first OIDC login | `true` |  |

## 🤝 Contributing

All ideas, issues, and pull requests are welcome!
