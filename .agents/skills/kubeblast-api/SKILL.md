---
name: kubeblast-api
description: Implement or debug Kubeblast's FastAPI backend, MongoDB persistence, authentication/RBAC, JMeter job lifecycle, Kubernetes workload orchestration, metrics, logs, events, or Python templates under api/. Use for any backend endpoint, model, service, worker, or runtime configuration change.
---

# Kubeblast API Development

Use this skill for changes under `api/` and for cross-layer work whose source of truth is the backend contract.

## Simplicity first

- Implement the smallest correct change that satisfies the explicit request. Do not add adjacent features, speculative extensibility, or future-proofing unless required.
- Prefer existing routes, models, services, dependencies, and standard-library tools over new abstractions or infrastructure.
- Do not introduce a new service, model, endpoint, configuration option, queue, framework, or helper when a direct change in the existing path is clear and maintainable.
- Keep control flow explicit and easy to trace. Avoid generic engines, deep indirection, clever metaprogramming, and premature deduplication.
- Preserve current contracts unless changing them is necessary. If a breaking change is unavoidable, make only that change and call it out.
- Add only focused tests for the requested behavior. Do not build elaborate test harnesses when a small isolated test is sufficient.
- Correctness, authorization, and data safety take priority over simplicity, but choose the simplest solution that preserves them.
- Stop when the requested behavior works and validation passes. Remove dead code made obsolete by the simplification.

## Comment discipline

- Do not add decorative section banners, JSX/YAML labels, step-by-step narration, or comments that restate the code.
- Do not leave commented-out code or long commented example blocks in source, templates, or values files.
- Add comments only for non-obvious behavior, security constraints, compatibility requirements, migration risks, or intentional exceptions.

## Map the change before editing

1. Trace HTTP behavior from `api/routes/` into `api/services/`, then into `api/core/` or `api/templates/`.
2. Keep route handlers thin. Put business rules, persistence, and Kubernetes orchestration in services.
3. Define request and response shapes in `api/core/models.py`; preserve FastAPI `response_model` validation where practical.
4. All public routes use `APIRouter(prefix="/api/v1")`. The web client and Nginx already supply this prefix, so frontend calls should remain relative, such as `/jobs`.
5. Register community routes in `api/main.py`. Licensed routes are imported and registered only after a valid license during startup; do not accidentally expose advanced behavior in community mode.

## Preserve runtime contracts

- Treat the job status literals in `api/core/models.py` as a cross-layer state machine. When adding or changing a status, inspect services, `api/worker.py`, and all frontend status handling.
- Enforce authorization in both route dependencies and object-level service checks. Regular users may only access their own jobs; moderator/admin behavior must remain explicit.
- MongoDB documents use `_id` internally and expose `id` strings through API models. Validate `ObjectId` input and return intentional `400`, `403`, or `404` errors rather than leaking conversion failures.
- Job artifacts live beneath `/data`; the PVC name is passed through `STORAGE_PVC_NAME`.
- Kubernetes resources created for tests use `kubeblast/job-id` and `kubeblast/job-component` labels. Cleanup, worker watches, logs, and scheduling depend on those labels.
- Workloads run in the pod's namespace read from the service-account namespace file. Local API startup does not reproduce this environment.
- InfluxDB behavior must remain conditional on `config.INFLUXDB_ENABLED`; community operation without InfluxDB must continue to work.
- Keep timestamps unambiguous. The frontend treats timezone-less API datetimes as UTC and renders them in the configured `TIMEZONE`.

## Configuration and deployment

When adding an environment variable:

1. Parse and default it in `api/config.py`.
2. Document it in the smallest appropriate place without adding long commented-out examples to `helm/values.yaml`.
3. Update `helm/templates/deployment.yaml` only if the chart must synthesize the value rather than pass it through `.Values.env` or `envFromSecret`.
4. Never hardcode credentials. Prefer `envFromSecret` for sensitive deployment values.

When adding Kubernetes API calls, inspect `helm/templates/rbac.yaml` and add only the minimum required resource and verbs.

## Advanced boundary

`advanced/` is a private Git submodule. The Docker build copies the community API and then overlays compiled files from `advanced/api/`. Do not invent or replace missing Advanced code when the submodule is unavailable, and do not move community features behind the license check unless explicitly requested.

## Validation

Start with the narrowest available checks:

```bash
python3 -m compileall -q api
```

Run focused tests under `api/tests/` when relevant. For non-trivial pure logic, add only small tests with a deliberate setup; mock MongoDB, Kubernetes, and InfluxDB boundaries instead of requiring a live cluster.

Do not use `python3 api/main.py` as a quick validation command: it starts a long-running server and startup immediately depends on MongoDB, Kubernetes-related workers, and optional licensed modules. Use the container or Skaffold integration path only when its dependencies, Kubernetes context, values file, and `advanced` submodule are available.

For changes to an API response or endpoint, also inspect matching calls under `web/src/` and update both sides in the same task.