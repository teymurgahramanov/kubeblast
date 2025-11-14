<p align="center">
    <img src="assets/logo.svg" style="width: 70%; height: auto;" />
</p>
<p align="center">
    Kubernetes-native load testing platform
</p>

# Kubeblast
Kubeblast turns your Kubernetes cluster into a collaborative Load Testing platform, where running JMeter load tests is simple and efficient.

No scripting, no setup — just run your tests and get results!

## ✨ Features
- __Simplicity First__ – Just upload your JMX file and click *Start*. That's it.
- __Intuitive UI__ – Manage jobs, view logs, and monitor execution in real-time.
- __Placement Control__ – Define which Kubernetes nodes to run workloads.
- __Resource Control__ – Set up requests and limits to fit your resource pool.

## ⭐ Pro Features
__Kubeblast Pro__ unlocks advanced features:
- __Built-in RBAC__ – Role-based access control with support for Users, Admins, and Moderators.
- __Moderation Workflow__ – Assign moderators to review and approve JMX test plans before execution.
- __LDAP Support__ – Integrate with LDAP for centralized authentication and access management.
- __OIDC Support__ – Integrate with OIDC provider for centralized authentication and access management.

To request access to the Pro edition, contact me at teymur_gahramanov@outlook.com or via [Telegram](https://t.me/teymurgahramanov).

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

## ❓ **Why Kubeblast?**  
Unlike YAML-heavy or SaaS-oriented alternatives, Kubeblast delivers a click-and-run experience for existing **JMeter (.jmx)** scripts, adds RBAC with optional moderator review, is flexible, open-source, and has the lightest footprint.


## 💡 Example Use-Cases

### 1. **Self-Service Load Testing for QA & Developers**
* **Problem** – Engineers keep pinging DevOps to spin up JMeter or, worse, run tests manually on their laptops.  
* **Solution** – Kubeblast’s Web UI lets users upload a JMX file, launch a test with a few clicks, watch execution logs, and get the report.

### 2. **Team-Wide Resource Sharing**
* **Problem** – Classic load-testing setups spin up extra VM fleets—or overwork developers’ laptops. 
* **Solution** – Kubeblast enables you to share your existing cluster resources with your team.

### 3. **Using Spare Cluster Capacity**
* **Problem** – You need to stress-test at scale but want to use existing resources and not to pay for extra.  
* **Solution** – Beside placement and resource control Kubeblast supports priority class configuration, allowing load tests to use idle cluster capacity — without impacting primary workloads.

### 4. **Load Test Scenario Moderation**
* **Problem** – An unchecked Load Test scenario can flood production, exhausts quotas or accidently (or intentionally) disrupt other workloads.
* **Solution** – With Kubeblast you can assign “moderator” roles and every new test plan will be reviewed before approving the run.

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
