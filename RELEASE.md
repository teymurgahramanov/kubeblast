# Kubeblast 1.4.0 🚀

## What's new?

### 📁 CSV parameter files
Upload one JMX plan together with up to 20 CSV parameter files, with a combined CSV limit of 100 MB. Kubeblast matches JMeter CSV Data Set Config filenames by basename and makes the files available in standalone and distributed tests.

### ✅ Job result verdicts
When a job completes, the Job Details page displays its passed, failed, or not-evaluated verdict together with total samples, failed samples, error rate, and any evaluation reason.

### 🖥️ Refined jobs experience
The Jobs page now provides capacity gauges, job cards, status filtering, sorting, search, and improved pagination. Repeat visits display the last successful capacity snapshot immediately and refresh it in the background, while Jobs, Job Details, and the user menu share cached application settings instead of issuing duplicate requests. User administration includes last-login information, the login page shows only configured authentication methods, and the user menu includes a Help link.

### 🎨 Consistent, refined interface
Material UI styling now uses a unified light and dark palette across login, jobs, job details, profile, and error states. User administration has been redesigned with responsive controls, clearer account and access details, improved search, and submission feedback in the add and edit forms.

### 🧭 Better runtime diagnostics
Job events now include Kubernetes workload events. Log collection retries while pods start, avoids duplicate lines, and captures final logs before completed or failed workloads are removed.

## Fixes and hardening

- Job lifecycle transitions are atomic, preventing duplicate or conflicting start, retry, and stop operations.
- Stopping a job remains in progress until Kubernetes confirms a terminal state.
- Capacity calculations exclude cordoned and NotReady nodes.
- Capacity database reads no longer block concurrent app and job API requests, and targeted MongoDB indexes improve counts, filtering, and pagination on larger installations.
- SSE parsing and Nginx proxy settings preserve split JSON, UTF-8 characters, and long-running log and event streams.
- Access tokens, refresh tokens, uploads, artifact paths, and invalid job IDs receive stricter validation.
- The application image runs as a non-root user and is published for AMD64 and ARM64.

## Breaking changes

- Community mode now permits login only for the `admin` role. Additional users and external authentication require a valid Advanced license.
- Advanced licensing now uses signed license content in `LICENSE_FILE`; `LICENSE_KEY` and `LICENSE_ID` are no longer used.
- Job API routes now use `/api/v1/jobs/{job_id}/...` for files, events, logs, metrics, lifecycle commands, and approval.
- `POST /api/v1/token/refresh` now accepts `{"refresh_token":"..."}` as a JSON body instead of a query parameter.
- Start, retry, and stop return HTTP `202` acknowledgements. Invalid or concurrent transitions return `409`, and retry accepts only completed or failed jobs.
- The bundled MongoDB chart is now Bitnami MongoDB `19.1.22`. Review and migrate existing MongoDB values and persistent data before upgrading.
- The application container now runs as UID/GID `10001` and listens for web traffic on container port `8080`; custom volumes must be writable by the non-root runtime.
- JMX plans are limited to 900 KB and must be valid `.jmx` files with a `jmeterTestPlan` root element.
