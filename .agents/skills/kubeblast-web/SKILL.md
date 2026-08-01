---
name: kubeblast-web
description: Implement or debug Kubeblast's React web UI under web/src, including routes, MUI components, authentication, API integration, job screens, live metrics, themes, and client-side tests. Use whenever changing frontend behavior or an API contract consumed by the UI.
---

# Kubeblast Web Development

Use this skill for the Create React App frontend in `web/`.

## Follow existing architecture

- Write JavaScript and JSX, not TypeScript, unless the user explicitly requests a migration.
- Put page and feature UI in `web/src/components/`; keep application routing in `web/src/App.js`.
- Use Material UI components and `sx` styling consistently with neighboring code.
- Reuse the light/dark palette and component defaults in `web/src/lib/theme.js`. Prefer theme palette values or the CSS variables in `web/src/App.css` over introducing isolated colors.
- Preserve responsive layouts and verify both light and dark modes for visible styling changes.

## API and authentication contracts

- Use `web/src/utils/axiosInstance.js` for authenticated requests. It supplies the base URL, bearer token, refresh queue, and login redirect behavior.
- Pass endpoint paths relative to `/api/v1`, for example `axiosInstance.get('/jobs')`; do not duplicate the API prefix.
- Avoid direct `axios` calls except for intentionally unauthenticated/token-bootstrap flows such as the refresh implementation.
- Read server error details defensively with `error.response?.data?.detail || error.message` and render failures through the existing UI patterns.
- Route visibility is not sufficient authorization. Backend role dependencies remain the security boundary.
- Advanced endpoints may not exist in community mode. Use `/stats/app` and `LICENSE_VALID` where the UI needs to gate Pro behavior.
- Keep access and refresh token storage compatible with `web/src/utils/auth.js` and the Axios interceptors.

## Cross-layer behavior

- If an API response shape, query parameter, pagination header, status, or SSE/metrics payload changes, update the backend and frontend together.
- `/jobs` pagination reads `X-Total-Count`; preserve case-insensitive header access.
- Job statuses are shared with `api/core/models.py`, backend services, and `api/worker.py`. Update every display, action guard, and color mapping when the state machine changes.
- API datetimes without an offset are normalized as UTC before display in the server-configured `TIMEZONE`.
- Keep polling and streaming effects cleanup-safe. Clear intervals, listeners, and network streams on unmount, and avoid starting duplicate pollers.

## Dependency discipline

- The production Docker stage uses Node 20 and `npm install`. Prefer Node 20 for parity when diagnosing build-only differences.
- Use the committed `web/package-lock.json`. Run `npm ci --prefix web` for a clean install and avoid lockfile churn unless dependencies intentionally change.
- Prefer packages already present in `web/package.json`, especially MUI, Recharts, Formik, Axios, Redux Toolkit, and Testing Library.

## Validation

Run the production build for frontend changes:

```bash
npm --prefix web run build
```

Run non-watch tests when relevant:

```bash
CI=true npm --prefix web test -- --watchAll=false
```

The repository currently has only `web/src/App.test.js`, and its default "learn react" assertion is stale relative to the current app. If a task touches `App.js` or establishes frontend test coverage, replace that assertion with behavior that exists; do not claim the existing test passes without running it.

For API-integrated UI changes, supplement automated checks with a focused review of loading, empty, error, unauthorized, community, and Pro states.