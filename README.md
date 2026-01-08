<p align="center">
    <img src="assets/logo.svg" style="width: 70%; height: auto;" />
</p>
<p align="center">
    Kubernetes-native load testing platform<br>
    <a href="https://kubeblast.io" target="_blank">kubeblast.io</a>
</p>

# Kubeblast
Kubeblast turns your Kubernetes cluster into a collaborative Load Testing platform, where running JMeter load tests is simple and efficient. It offers a simple *click-and-run* workflow, built-in RBAC with moderator approval, full flexibility, and a lightweight open-source footprint.

## ▶️ Quick start
1. Add Helm repository
   ```bash
   helm repo add teymurgahramanov https://teymurgahramanov.github.io/charts && helm repo update teymurgahramanov
   ```
2. Install Helm chart
   ```
   helm upgrade --install kubeblast teymurgahramanov/kubeblast
   ```
3. Access UI on http://localhost:8080 using username `admin` and password `admin`. You can use [test.jmx](./test.jmx) for testing.
   ```
   kubectl port-forward svc/kubeblast 8080:80
   ```

## 👍 Get more
Kubeblast is built to scale from quick, single-click load tests to full team workflows on Kubernetes.
For the complete list of **Base** and **Advanced** features, visit [kubeblast.io](https://kubeblast.io).

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
| `TIMEZONE` | string | Application timezone (used for API/UI datetime rendering) | `UTC` | `Europe/Berlin` |
| `JMETER_MODE` | string | JMeter mode: `standalone` or `distributed` | `standalone` | `distributed` |
| `WORKER_WATCH_INTERVAL` | int | Worker full resync interval (seconds) | `300` | `120` |
| `WORKER_WATCH_TIMEOUT` | int | Kubernetes watch stream timeout (seconds) | `60` | `30` |
| `K8S_METRICS_SERVER` | string | Metrics Server URL used for capacity data retrieval | `https://metrics-server.kube-system` | `https://metrics-server.kube-system` |
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
| `K8S_JOB_RESOURCES_MASTER` | JSON | Resource requests/limits for the JMeter master job in distributed mode (JSON) | `{}` | `{"requests": {"cpu": "500m", "memory": "1Gi"}, "limits": {"cpu": "2", "memory": "4Gi"}}` |
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
