# GitVersion Image Tagging & Footer Version Display

**Date:** 2026-04-20  
**Status:** Approved

## Goal

Use GitVersion to produce semantic version tags for container images. Only git-tagged commits (`v*`) receive a SemVer tag. All commits to `main` continue to receive `latest`. The frontend footer displays both the semantic version (linked to the GitHub release) and the commit SHA (linked to the commit).

## Branching Strategy

GitHub Flow: `main` + feature branches. Git tags are the sole source of release versions. No pre-release suffixes for untagged commits.

## File Changes

```
GitVersion.yml                             # new — GitVersion configuration
.github/workflows/docker.yml               # renamed → ci.yml
.github/workflows/ci.yml                   # renamed from docker.yml — unchanged behavior
.github/workflows/release.yml              # new — tag-triggered release workflow
.github/workflows/build-images.yml         # new — reusable build workflow
frontend/src/components/Footer.tsx         # updated — show version + SHA
Dockerfile.frontend                        # updated — accept VERSION build arg
```

## GitVersion Configuration (`GitVersion.yml`)

```yaml
mode: ContinuousDelivery
branches:
  main:
    is-mainline: true
    increment: Patch
```

Tags are the source of truth. A tag `v1.2.0` on `main` causes GitVersion to output `1.2.0`. No pre-release suffix is used — untagged builds do not receive a SemVer image tag.

## Reusable Workflow (`.github/workflows/build-images.yml`)

Triggered via `workflow_call`. Inputs:

| Input | Type | Required | Description |
|---|---|---|---|
| `version` | string | no | SemVer string (e.g. `1.2.3`). When set, images are tagged `v{version}` in addition to `latest`. |

The four build jobs (cronjob, backend, worker, frontend) are defined here and shared between `ci.yml` and `release.yml`. No duplication.

For the frontend job, `VERSION` is passed as an additional `build-arg` alongside the existing `COMMIT_SHA`.

Image tags produced:

| Caller | Tags pushed |
|---|---|
| `ci.yml` (push to main) | `latest`, `sha-{short}` |
| `release.yml` (push tag `v*`) | `v{semver}`, `latest`, `sha-{short}` |

## CI Workflow (`.github/workflows/ci.yml`)

- Trigger: `push: branches: [main]`
- Steps: run tests → call `build-images.yml` without `version` input
- Renamed from `docker.yml`; behavior unchanged

## Release Workflow (`.github/workflows/release.yml`)

- Trigger: `push: tags: ['v*']`
- Steps:
  1. `actions/checkout@v4` with `fetch-depth: 0` (GitVersion requires full history)
  2. `gittools/actions/gitversion/setup@v3` — installs GitVersion
  3. `gittools/actions/gitversion/execute@v3` — outputs `semVer` (e.g. `1.2.3`)
  4. Run tests
  5. Call `build-images.yml` with `version: ${{ steps.gitversion.outputs.semVer }}`

## Frontend Dockerfile

```dockerfile
ARG COMMIT_SHA
ARG VERSION
ENV VITE_COMMIT_SHA=$COMMIT_SHA
ENV VITE_VERSION=$VERSION
```

Both args are optional. When `VERSION` is absent (CI builds), `VITE_VERSION` is empty and the footer omits the version link.

## Frontend Footer

`Footer.tsx` reads:
- `VITE_VERSION` → display as `v1.2.3`, link to `https://github.com/{repo}/releases/tag/v{version}`
- `VITE_COMMIT_SHA` → display as short SHA (7 chars), link to commit (existing behavior)

Display format when both are present:
```
v1.2.3 · a3f2c1b
```

When only SHA is available (CI builds without a tag):
```
a3f2c1b
```

The footer is hidden when neither version nor SHA nor email is available (existing behavior preserved).

## Out of Scope

- Automatic version increment via commit message conventions (Conventional Commits)
- Pre-release image tags for untagged commits
- Changes to backend, worker, or cronjob containers beyond image tagging
