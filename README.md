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

Prerequisites:
- Kubernetes cluster with permission to create namespace-scoped resources, a `ClusterRole`, and a `ClusterRoleBinding`
- A default StorageClass that supports `ReadWriteMany`, or an existing RWX claim configured with `pvc.existingClaim`

1. Add Helm repository
   ```bash
   helm repo add teymurgahramanov https://teymurgahramanov.github.io/charts && helm repo update teymurgahramanov
   ```
2. Install Helm chart
   ```
   helm upgrade --install kubeblast teymurgahramanov/kubeblast \
   --namespace kubeblast \
   --create-namespace \
   --wait \
   --timeout 10m
   ```
3. Access UI on http://localhost:8080 using username `admin` and password `admin`. Change the default password before exposing Kubeblast beyond this local port-forward. You can use [test.jmx](./test.jmx) for testing.
   ```
   kubectl -n kubeblast port-forward svc/kubeblast 8080:80
   ```
## ⚙️ Configuration
All parameters are configurable via environment variables.
You can define them directly using Helm values or store in a Kubernetes Secret.
See [`helm/values.yaml`](./helm/values.yaml) for the full list of supported environment variables with defaults and examples. Enhanced documentation is available at [kubeblast.io/docs](https://kubeblast.io/docs).

## 👍 Get more
Kubeblast scales from quick, single-click load tests to a collaborative platform with enterprise-grade capabilities. See the full feature list at [kubeblast.io](https://kubeblast.io).

## 🤝 Contributing

All ideas, issues, and pull requests are welcome!
