<p align="center">
    <img src="logo.svg" style="width: 75%; height: auto;" />
</p>
<p align="center" style="font-size:20px;">
Kubernetes-native load testing platform</p>

Kubeblast makes running __JMeter__ load tests simple and efficient. No scripting, no setup — just run your tests and get results!

## ⭐ Features
- __Intuitive UI__ – Manage jobs, view logs, and monitor execution in real-time.
- __Simplicity First__ – Just upload your JMX file and click Run. That’s it.
- __Placement Control__ – Define which Kubernetes nodes to run workloads.
- __Storage Backends__ – Support for S3 (AWS, MinIO) and PVC-based file storages.
- __Distributed Workloads__ – Automatic deployment of JMeter slaves across the desired nodes for massive parallelism.
- __Built-in RBAC__ – Role-based access control with support for Users, Admins, and Moderators.
- __Moderation Workflow__ – Assign moderators to review and approve JMX test plans before execution.
- __LDAP Support__ – Integrate with your existing LDAP directory for centralized authentication and access management.

## ▶️ Quick start
1. Install MongoDB
   ```bash
   helm install mongodb oci://registry-1.docker.io/bitnamicharts/mongodb \
   --set auth.enabled=true \
   --set auth.rootPassword="Root12345!" \
   --set auth.username="kubeblast" \
   --set auth.password="kubeblast" \
   --set auth.database="kubeblast"
   ```
2. Add and update Helm repository
   ```bash
   helm repo add teymurgahramanov https://teymurgahramanov.github.io/charts && helm repo update teymurgahramanov
   ```
3. Set values
   ``` bash
   cat <<EOF > kubeblast.yaml
   env:
     - name: MONGO_HOST
       value: "mongodb.infra"
     - name: MONGO_PORT
       value: "27017"
     - name: MONGO_DB_NAME
       value: "kubeblast"
     - name: MONGO_DB_USER
       value: "kubeblast"
     - name: MONGO_DB_PASS
       value: "kubeblast"
   EOF
   ```
3. Install Helm chart
   ```
   helm upgrade --install teymurgahramanov/kubeblast -f kubeblast.yaml
   ```