<p align="center">
    <img src="assets/logo.svg" style="width: 70%; height: auto;" />
</p>
<p align="center">
    Kubernetes-native load testing platform
</p>

Kubeblast turns your Kubernetes cluster into a Load Testing platform, where running JMeter load tests is simple and efficient. No scripting, no setup — just run your tests and get results!

## ⭐ Features
- __Simplicity First__ – Just upload your JMX file and click *Start*. That’s it.
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
   helm upgrade --install teymurgahramanov/kubeblast -f kubeblast.yaml
   ```
3. Access
   ```
   kubectl port-foward
   ```