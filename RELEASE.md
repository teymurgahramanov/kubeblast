## Kubeblast 1.1.0 (2025-11-13)

### Highlights
- Dark theme support, new capacity dashboards, and in‑browser reporting/views.
- OAuth with token rotation.
- Broad UI/UX improvements across users, capacity board, and jobs pages.
- Removal of S3 storage backend and dashboard generation output (potentially breaking).

### Added
- enabled dark theme (b4d7049)
- in browser report (659cc41)
- added capacity dashboard and improved worker (71c5443)
- redesigned jobs page; added cluster capacity dashboard (ca0d8f1)
- added oauth and token rotation (22368d0)
- added in browser dashboard view (2de6e2a)
- added stop function (5fd1eb8)

### Improvements
- ui improvments (b1af06f)
- improved Users UI (2afdbfc)
- improved capacity board (f36da6f)
- minor view tweaks (963bd78)

### Removed / Breaking changes
- remove dashboard generation; kept only result (b687402)
- removed s3 storage backend (77d8f37)

If you rely on the S3 storage backend or dashboard generation artifacts:
- Migrate any workflows that depended on generated dashboard files to consume the persisted results instead.
- Replace S3 storage usage with the supported storage mechanism configured in your deployment.


