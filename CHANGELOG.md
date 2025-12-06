# Changelog

## [1.1.4] - 2025-12-02

### Added
- Configurable application timezone via the `TIMEZONE` environment variable, exposed through the `/stats/app` API endpoint.
- Jobs page now uses the server-configured timezone to render job creation timestamps instead of the browser local time.
- Server-side pagination for `/api/jobs` and paginated Jobs UI with configurable page size and client-side search over the current page.

### Fixed
- Inconsistent datetime handling between backend storage and UI display; timestamps are now treated as UTC and converted to the configured timezone on the frontend.

## [1.1.3] - 2025-11-24

### Added
- Footer displaying app version and edition on all pages

### Changed
- Release workflow now automatically updates APP_VERSION in config.py

## [1.1.2] - 2025-11-23

### Changed

- Moderators can now create jobs

## [1.1.1] - 2025-11-17

### Changed
- Improved cluster capacity calculation: refactored with regex-based parsing, shows remaining resources instead of allocatable, added background warming/caching for faster responses.
- Faster login: reduced bcrypt rounds from 12 to 8 for faster password verification (~100ms vs ~2500ms).
- Enhanced Helm chart: added readiness probe to main deployment, added resource limits and image pull configuration to MongoDB deployment, added support for extra volumes and volume mounts.
- Capacity dashboard: added overall jobs running metric, improved refresh logic (stops when tab is hidden), better error handling (keeps showing last known resources).

## [1.1.0] - 2025-11-14

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
- Removed separate "pro" image.
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