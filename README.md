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
   helm upgrade --install kubeblast teymurgahramanov/kubeblast \
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
See [`helm/values.yaml`](./helm/values.yaml) for the full list of supported environment variables with defaults and examples.

### MongoDB dependency

The chart installs MongoDB from the pinned Bitnami OCI dependency declared in [`helm/Chart.yaml`](./helm/Chart.yaml). MongoDB users, databases, persistence, and resources are configured under `mongodb` in [`helm/values.yaml`](./helm/values.yaml).

When upgrading from a release that used Kubeblast's former bundled MongoDB chart, back up MongoDB first. The Bitnami chart uses different StatefulSet selectors and PVC names, so existing MongoDB data is not migrated or attached automatically.

### External MongoDB and InfluxDB

Both bundled database dependencies can be disabled independently or together. Configure non-sensitive connection settings through `env` and load credentials from `envFromSecret`:

```yaml
mongodb:
  enabled: false

influxdb:
  enabled: false

env:
  - name: INFLUXDB_ENABLED
    value: "true"
  - name: INFLUXDB_DATABASE
    value: "jmeter"

envFromSecret: kubeblast-external-databases
```

The referenced Secret can provide the external endpoints and credentials:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: kubeblast-external-databases
type: Opaque
stringData:
  MONGODB_URI: "mongodb+srv://user:password@cluster.example.com/kubeblast"
  MONGODB_NAME: "kubeblast"
  INFLUXDB_URL: "https://influxdb.example.com"
```

`MONGODB_URI` supports a complete standard or SRV connection URI and takes precedence over the individual MongoDB connection variables. External InfluxDB must expose the InfluxDB 1.x-compatible `/write` and `/query` APIs used by JMeter and Kubeblast.

## 👍 Get more
Kubeblast scales from quick, single-click load tests to a collaborative platform with enterprise-grade capabilities. See the full feature list at [kubeblast.io](https://kubeblast.io).

## 🤝 Contributing

All ideas, issues, and pull requests are welcome!
