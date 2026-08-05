# Changelog

## [1.3.0]

### Added

- Optional **InfluxDB** (enabled by default in the main Helm `values.yaml`) integration for JMeter: configurable Backend Listener injection on scheduled workloads, `kb-`–prefixed `application` tag for per-job series, metrics query API, and a bundled **Grafana** dashboard JSON.
- **Live metrics** charts on the Job Details page (when InfluxDB is enabled); API marks timestamps as **UTC epoch milliseconds** (`timestamps_epoch_ms_utc`) for client display using the configured app timezone.
- **Plan file editing**: `PUT /api/v1/jobs/{job_id}/plan` replaces the stored JMX when the job is **ready**, **completed**, or **failed**; Job Details **Plan** tab adds an editor with XML highlighting and save/cancel (approval rules re-applied via owner **auto_approve** / license, same as new jobs).
- Staggered startup for background tasks: fixed **5s** delay before the first capacity sync and before the job-status worker starts, so the API can bind and serve health checks first.
- FastAPI **lifespan** context for startup ordering (replacing ad-hoc initialization on import where applicable).

### Changed

- Redesigned **login** page, refined **Job Details** and **Jobs** UI (@Yesveer)
- **Report download**: packaged HTML report as `kb-{job-name}-report.zip` instead of opening report HTML in the browser; JTL result file named `kb-{job-name}-result.jtl`.
- **Pod logs persisted in MongoDB**: a background reader tails the master pod into a **`job_logs`** collection; `GET /api/v1/jobs/{job_id}/logs` streams **SSE** with JSON payloads `{"job_id","ts","msg"}` (aligned with job **events**). **Retry** and **delete job** clear stored log lines; **retry** also drops **InfluxDB** series for the job when metrics are enabled.
- **OIDC** (Advanced): authorization URL query parameters are properly URL-encoded; token and userinfo HTTP clients use explicit timeouts and form content type for the token exchange.
- **OIDC callback** now passes **raw IdP claims** into login so user/role mapping runs once with full token claims (e.g. Keycloak realm roles); API response `username` / `role` are read from the persisted user after login.
- **Startup**: admin user bootstrap is wrapped in **try/except** with error logging and **process exit** on failure; missing license env sets **`LICENSE_VALID`** to **false**; **`license_check`** failures are handled with a single warning path instead of only `ImportError`.
- **JMeter workloads**: master and slave pods set **`TZ=UTC`** so InfluxDB line-protocol timestamps are consistent UTC instants.
- **Frontend nginx**: removed the extra **`/static/`** location block;
- In-app **API docs** hide **`metrics`** and **`jobs_extra`** OpenAPI tags (alongside existing exclusions).

### Fixed

- Users are no longer logged out automatically when the browser is closed (session / token handling).
- OIDC users no longer lose correct **role** mapping when the callback had pre-normalized user data (second mapping pass stripped IdP role claims).

### Breaking changes
- **MongoDB** subchart migrated to a **StatefulSet** with `volumeClaimTemplates`. PVC names have changed, which may affect existing data and upgrades.
- **InfluxDB** is now deployed by default with the chart.


## [1.2.0]

### Added

- Distributed load testing with JMeter master/slave architecture.
- Personal Access Tokens (PATs) in the user profile, with a new `/api/v1/pats` API endpoint (Advanced edition only).
- In-app API documentation, accessible directly from the Profile page.
- Dedicated Job page for improved job visibility.
- Job events: server-side event logging plus Server-Sent Events (SSE) streaming endpoint, surfaced in the Jobs UI.
- Automatic workload cleanup after jobs complete or fail.

### Changed

- API routes moved to versioned prefix `/api/v1`; updated frontend base URL, Nginx routing, Helm readiness probe, and docs links.
- Capacity retrieval now uses Kubernetes Metrics Server (configurable URL) and improved capacity warming.
- OIDC: routes separated and authentication flow refactored with normalized user data and improved username mapping/error handling.
- Job status synchronization refactored (Kubernetes watch + periodic full resync) with new worker watch/timeout settings.
- Jobs UI: resource label changed from "Requests / Limit" to "Min / Max".

### Fixed

- Patched React2Shell vulnerability (frontend dependencies).

## [1.1.5]

### Changed

- Enabled MongoDB subchart by default

## [1.1.4]

### Added
- Configurable application timezone via the `TIMEZONE` environment variable, exposed through the `/stats/app` API endpoint.
- Jobs page now uses the server-configured timezone to render job creation timestamps instead of the browser local time.
- Server-side pagination for `/api/jobs` and paginated Jobs UI with configurable page size and client-side search over the current page.

### Fixed
- Inconsistent datetime handling between backend storage and UI display; timestamps are now treated as UTC and converted to the configured timezone on the frontend.

## [1.1.3]

### Added
- Footer displaying app version and edition on all pages

### Changed
- Release workflow now automatically updates APP_VERSION in config.py

## [1.1.2]

### Changed

- Moderators can now create jobs

## [1.1.1]

### Changed
- Improved cluster capacity calculation: refactored with regex-based parsing, shows remaining resources instead of allocatable, added background warming/caching for faster responses.
- Faster login: reduced bcrypt rounds from 12 to 8 for faster password verification (~100ms vs ~2500ms).
- Enhanced Helm chart: added readiness probe to main deployment, added resource limits and image pull configuration to MongoDB deployment, added support for extra volumes and volume mounts.
- Capacity dashboard: added overall jobs running metric, improved refresh logic (stops when tab is hidden), better error handling (keeps showing last known resources).

## [1.1.0]

### Added
- Dark theme.
- Capacity dashboard.
- OIDC Support.
- Job stop function.
- In browser JMeter report view.
- Jmeter result file download.
- Token rotation.

### Changed
- Renamed some variables. Check [README.md](README.md).
- Replaced Bitnami MongoDB Helm Chart with simple deployment.
- Removed separate "advanced" image.
- Optimized Job manifest.
- Redesigned Jobs page.
- Improved Job status sync.
- Ovearall UI improvments.
- Optimized Helm chart.
- Other minor improvments.

### Removed
- Jmeter report download.
- S3 storage support.

## [1.0.0] - 2025-06-15

The first release 🎉