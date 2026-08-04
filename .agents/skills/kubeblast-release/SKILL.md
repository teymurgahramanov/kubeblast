---
name: kubeblast-release
description: Prepare or execute a Kubeblast version release, including release notes, changelog review, version consistency, Docker image publication, Helm chart publication, and GitHub release workflow checks. Use only when the user explicitly asks to prepare, publish, or audit a release.
disable-model-invocation: true
---

# Kubeblast Release

Use this skill only after an explicit release request. Release operations publish artifacts and mutate remote repositories.

## Safety gate

- Never dispatch `.github/workflows/release.yaml`, commit, push, create a tag, or publish an image/chart without explicit user approval for that action.
- Start from a clean worktree and identify the intended source branch and semantic version.
- Use a Helm-compatible semantic version such as `1.3.1` unless the user has chosen a valid prerelease form. Confirm whether Docker/Git tags should include a leading `v`; the current workflow uses the input literally everywhere and existing versions omit `v`.
- Verify the private `advanced` submodule is available at the intended revision. The release checkout initializes submodules and the Docker build requires `advanced/api/`.
- Do not expose repository, Docker Hub, Helm repository, or Advanced-submodule credentials in logs or files.

## Understand workflow ownership

The manual `Create release` workflow accepts `release-name` and then:

1. Updates `api/config.py` `APP_VERSION`.
2. Updates both `version` and `appVersion` in `helm/Chart.yaml`.
3. Commits and pushes those version changes.
4. Builds and pushes Docker tags `<release-name>` and `latest`.
5. Runs `helm dependency update`, packages the chart, and pushes the Helm repository index to its `gh-pages` repository.
6. Creates or updates a GitHub release and tag using `RELEASE.md` as the body.

Do not manually duplicate workflow-owned version bumps unless the user specifically wants a pre-bump commit or workflow redesign.

## Prepare release content

1. Review commits and user-visible changes since the previous release.
2. Update `CHANGELOG.md` with Added, Changed, Fixed, Removed, and Breaking changes as applicable.
3. Rewrite `RELEASE.md` as concise end-user release notes for exactly this version.
4. Check public version references such as the `README.md` heading and decide whether they should be updated before dispatch.
5. Call out storage, PVC, database, API, authentication, configuration-default, and RBAC changes explicitly.
6. Verify upgrade guidance for any breaking Helm or MongoDB behavior.

## Validate before publication

Run the checks relevant to the release contents:

```bash
python3 -m compileall -q api
npm --prefix web run lint
npm --prefix web test
npm --prefix web run build
helm dependency update helm
helm lint helm
helm template kubeblast helm --namespace kubeblast
```

The frontend uses Vitest in non-watch mode via `npm --prefix web test`; do not claim it passes without running it.

If the Advanced submodule and container runtime are available, build the production image because it is the true integration boundary for Nginx, Supervisor, React, Python dependencies, Nuitka-compiled native extensions, and the Advanced overlay.

## Pre-dispatch checklist

Report, and obtain confirmation for, all of the following:

- release version and source commit/branch
- clean worktree status
- `CHANGELOG.md` and `RELEASE.md` readiness
- required validation results and any skipped checks
- Advanced submodule revision and availability
- required GitHub secrets: `PAT`, Docker Hub credentials, and Helm repository owner/token
- expected remote mutations: source version-bump commit, Docker tags, Helm package/index commit, Git tag, and GitHub release

After publication, verify the GitHub release body/tag, image tags, Helm repository index/package, and that a clean Helm install resolves the new default image tag.