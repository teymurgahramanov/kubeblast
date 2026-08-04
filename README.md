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

### CSV parameter files

A job can include one JMX plan and up to 20 CSV parameter files (100 MB combined). Kubeblast matches each JMeter `CSV Data Set Config` filename by basename and makes the uploaded file available to the JMeter engines. JMX plans are limited to 900 KB because the runtime plan is stored in a Kubernetes ConfigMap.

Deployments behind an ingress must configure its request body limit to at least 110 MB; an NGINX Ingress example is included in `helm/values.yaml`. Distributed execution requires storage that supports read/write mounts from all selected nodes, such as a `ReadWriteMany` PVC.

## 👍 Get more
Kubeblast scales from quick, single-click load tests to a collaborative platform with enterprise-grade capabilities. See the full feature list at [kubeblast.io](https://kubeblast.io).

## 🤝 Contributing

All ideas, issues, and pull requests are welcome!
