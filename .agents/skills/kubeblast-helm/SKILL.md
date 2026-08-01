---
name: kubeblast-helm
description: Modify or review Kubeblast's Helm chart, Kubernetes manifests, RBAC, values, storage, ingress, MongoDB/InfluxDB dependencies, Docker packaging, or Skaffold development deployment. Use for changes under helm/ or Kubernetes deployment behavior.
---

# Kubeblast Helm and Deployment

Use this skill for `helm/`, deployment-facing parts of `Dockerfile`, and `skaffold.yaml`.

## Understand the deployment shape

- The main chart is an application chart in `helm/Chart.yaml`.
- A single Kubeblast pod runs Nginx and FastAPI under Supervisor. Nginx serves the React build and proxies `/api/v1/` to port `8000`.
- The main pod mounts the shared data PVC at `/data`.
- The chart includes the local `helm/charts/mongodb` subchart and declares the official InfluxDB chart dependency. Both are enabled by default.
- The application service exposes named `web` and `api` ports. The readiness probe calls `/api/v1/stats/app` on the API port.
- Kubeblast creates and watches JMeter Jobs, ConfigMaps, Services, pods, and distributed-mode DaemonSets at runtime. RBAC is part of application correctness.

## Make chart changes coherently

1. Add or change the user-facing setting in `helm/values.yaml`, including a useful comment and safe default.
2. Consume it in the relevant file under `helm/templates/` or the MongoDB subchart.
3. Update `README.md` when installation or operator behavior changes. Keep `helm/values.yaml` as the complete environment-variable reference.
4. For application environment variables, prefer the generic `.Values.env` and `envFromSecret` mechanisms. Add dedicated values only when the chart must calculate or wire a value.
5. Quote string values in templates. Use `toYaml` plus `nindent` for maps and lists, and guard optional blocks with `with` or `if`.
6. Preserve existing labels and helper-generated names so selectors, upgrades, and cleanup remain stable.
7. Treat StatefulSet/PVC naming or selector changes as migrations and document them as breaking changes.

## Security and RBAC

- Never put real secrets in defaults. Keep examples inert and direct sensitive values to `envFromSecret`.
- Add the narrowest Kubernetes RBAC permissions required by actual calls in `api/services/k8s.py`, `api/core/k8s.py`, `api/services/capacity.py`, and `api/worker.py`.
- Distinguish namespace-scoped access from cluster-scoped node, pod, and Metrics API reads. Avoid widening verbs to `*`.
- Review security context, volume, ingress TLS, and external database implications when changing defaults.

## Version ownership

Do not bump `helm/Chart.yaml` versions as part of an ordinary chart fix. The release workflow updates both `version` and `appVersion` from the explicit release name. Version changes belong to release preparation.

## Validation

When dependencies are not present, fetch them before linting or rendering:

```bash
helm dependency update helm
helm lint helm
helm template kubeblast helm --namespace kubeblast
```

`helm dependency update` can create or modify dependency metadata and archives. Review those changes and do not commit generated artifacts unless repository conventions require them.

Exercise important conditionals for relevant changes, especially:

```bash
helm template kubeblast helm --namespace kubeblast --set mongodb.enabled=false --set influxdb.enabled=false
helm template kubeblast helm --namespace kubeblast --set ingress.enabled=true --set ingress.host=kubeblast.example.com
```

For Docker changes, remember that the build requires the private `advanced` submodule because it obfuscates and overlays `advanced/api/`. Use a bounded image build only when that submodule is initialized.

For Skaffold changes, confirm `dev-values.yaml` exists in the developer environment before running. `skaffold.yaml` expects it but it is not committed in this repository.