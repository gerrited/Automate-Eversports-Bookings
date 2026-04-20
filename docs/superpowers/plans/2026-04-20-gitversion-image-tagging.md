# GitVersion Image Tagging & Footer Version Display — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up GitVersion so that git-tagged commits (`v*`) produce SemVer-tagged container images, and display the version in the frontend footer alongside the existing commit SHA.

**Architecture:** A reusable GitHub Actions workflow (`build-images.yml`) holds the 4 Docker build jobs. Two caller workflows invoke it: `ci.yml` (push to main, `latest` only) and `release.yml` (push to `v*` tags, runs GitVersion and passes the SemVer). The frontend footer reads `VITE_VERSION` at build time and shows `v1.2.3 · a3f2c1b` when both are present.

**Tech Stack:** GitHub Actions, GitVersion 6.x (`gittools/actions`), `docker/metadata-action@v5`, Vite (env vars via `import.meta.env`), React, Vitest + `@testing-library/react`

---

## File Map

| Action | File |
|---|---|
| Create | `GitVersion.yml` |
| Create | `.github/workflows/build-images.yml` |
| Rename + rewrite | `.github/workflows/docker.yml` → `ci.yml` |
| Create | `.github/workflows/release.yml` |
| Modify | `Dockerfile.frontend` |
| Create | `frontend/src/components/Footer.test.tsx` |
| Modify | `frontend/src/components/Footer.tsx` |

---

## Task 1: Create `GitVersion.yml`

**Files:**
- Create: `GitVersion.yml`

- [ ] **Step 1: Create the file**

```yaml
# GitVersion.yml
mode: ContinuousDelivery
branches:
  main:
    is-mainline: true
    increment: Patch
```

- [ ] **Step 2: Commit**

```bash
git add GitVersion.yml
git commit -m "chore: add GitVersion configuration"
```

---

## Task 2: Create reusable build workflow

The 4 build jobs currently in `docker.yml` move here. This workflow is called by both `ci.yml` and `release.yml`. It accepts an optional `version` input; when set, images get an additional `v{version}` tag. The frontend job gets a `VERSION` build-arg. `GITHUB_REPO` is changed from the GHCR path (`ghcr.io/gerrited/...`) to `github.repository` (`gerrited/automate-eversports-bookings`) — this also fixes a pre-existing bug where the commit link in the footer pointed to a broken URL.

**Files:**
- Create: `.github/workflows/build-images.yml`

- [ ] **Step 1: Create the file**

```yaml
# .github/workflows/build-images.yml
name: Build and push Docker images

on:
  workflow_call:
    inputs:
      version:
        description: 'SemVer string (e.g. 1.2.3). When set, images are also tagged v{version}.'
        type: string
        required: false
        default: ''

env:
  REPO_LC: ghcr.io/gerrited/automate-eversports-bookings

jobs:
  build-cronjob:
    name: cronjob (book.py)
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/metadata-action@v5
        id: meta
        with:
          images: ${{ env.REPO_LC }}-cronjob
          tags: |
            type=sha,prefix=
            type=raw,value=latest
            ${{ inputs.version != '' && format('type=raw,value=v{0}', inputs.version) || '' }}
      - uses: docker/build-push-action@v6
        with:
          context: .
          file: Dockerfile.cronjob
          push: true
          platforms: linux/amd64,linux/arm64
          tags: ${{ steps.meta.outputs.tags }}
          cache-from: type=registry,ref=${{ env.REPO_LC }}-cronjob:buildcache
          cache-to: type=registry,ref=${{ env.REPO_LC }}-cronjob:buildcache,mode=max

  build-backend:
    name: backend
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/metadata-action@v5
        id: meta
        with:
          images: ${{ env.REPO_LC }}-backend
          tags: |
            type=sha,prefix=
            type=raw,value=latest
            ${{ inputs.version != '' && format('type=raw,value=v{0}', inputs.version) || '' }}
      - uses: docker/build-push-action@v6
        with:
          context: .
          file: Dockerfile.backend
          push: true
          platforms: linux/arm64
          tags: ${{ steps.meta.outputs.tags }}
          cache-from: type=registry,ref=${{ env.REPO_LC }}-backend:buildcache
          cache-to: type=registry,ref=${{ env.REPO_LC }}-backend:buildcache,mode=max

  build-worker:
    name: worker
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/metadata-action@v5
        id: meta
        with:
          images: ${{ env.REPO_LC }}-worker
          tags: |
            type=sha,prefix=
            type=raw,value=latest
            ${{ inputs.version != '' && format('type=raw,value=v{0}', inputs.version) || '' }}
      - uses: docker/build-push-action@v6
        with:
          context: .
          file: Dockerfile.worker
          push: true
          platforms: linux/arm64
          tags: ${{ steps.meta.outputs.tags }}
          cache-from: type=registry,ref=${{ env.REPO_LC }}-worker:buildcache
          cache-to: type=registry,ref=${{ env.REPO_LC }}-worker:buildcache,mode=max

  build-frontend:
    name: frontend
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/metadata-action@v5
        id: meta
        with:
          images: ${{ env.REPO_LC }}-frontend
          tags: |
            type=sha,prefix=
            type=raw,value=latest
            ${{ inputs.version != '' && format('type=raw,value=v{0}', inputs.version) || '' }}
      - uses: docker/build-push-action@v6
        with:
          context: .
          file: Dockerfile.frontend
          push: true
          platforms: linux/arm64
          tags: ${{ steps.meta.outputs.tags }}
          cache-from: type=registry,ref=${{ env.REPO_LC }}-frontend:buildcache
          cache-to: type=registry,ref=${{ env.REPO_LC }}-frontend:buildcache,mode=max
          build-args: |
            COMMIT_SHA=${{ github.sha }}
            GITHUB_REPO=${{ github.repository }}
            VERSION=${{ inputs.version }}
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/build-images.yml
git commit -m "ci: add reusable build-images workflow"
```

---

## Task 3: Replace `docker.yml` with `ci.yml`

The old file is deleted. The new `ci.yml` keeps the test job and delegates building to `build-images.yml`. `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` is kept.

**Files:**
- Create: `.github/workflows/ci.yml`
- Delete: `.github/workflows/docker.yml`

- [ ] **Step 1: Create `ci.yml`**

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  workflow_dispatch:

env:
  FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true

jobs:
  test:
    name: tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.13"
      - run: pip install -r requirements-backend.txt
      - run: pytest tests/ -v
        env:
          JWT_SECRET: test-secret

  build:
    name: build images
    needs: test
    uses: ./.github/workflows/build-images.yml
```

- [ ] **Step 2: Delete `docker.yml`**

```bash
git rm .github/workflows/docker.yml
```

- [ ] **Step 3: Stage and commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: rename docker.yml to ci.yml, extract build jobs to reusable workflow"
```

---

## Task 4: Create `release.yml`

Triggered by `v*` tags. Runs tests, calculates version via GitVersion, then delegates building to `build-images.yml` with the version.

**Files:**
- Create: `.github/workflows/release.yml`

- [ ] **Step 1: Create the file**

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags: ['v*']

env:
  FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true

jobs:
  test:
    name: tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-python@v5
        with:
          python-version: "3.13"
      - run: pip install -r requirements-backend.txt
      - run: pytest tests/ -v
        env:
          JWT_SECRET: test-secret

  version:
    name: calculate version
    runs-on: ubuntu-latest
    outputs:
      semver: ${{ steps.gitversion.outputs.semVer }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: gittools/actions/gitversion/setup@v3
        with:
          versionSpec: '6.x'
      - uses: gittools/actions/gitversion/execute@v3
        id: gitversion

  build:
    name: build images
    needs: [test, version]
    uses: ./.github/workflows/build-images.yml
    with:
      version: ${{ needs.version.outputs.semver }}
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci: add release workflow with GitVersion and SemVer image tagging"
```

---

## Task 5: Update `Dockerfile.frontend`

Add `VERSION` as a build-arg/env alongside the existing `COMMIT_SHA`.

**Files:**
- Modify: `Dockerfile.frontend`

- [ ] **Step 1: Add the VERSION arg**

In `Dockerfile.frontend`, find the block:

```dockerfile
ARG COMMIT_SHA
ARG GITHUB_REPO
ENV VITE_COMMIT_SHA=$COMMIT_SHA
ENV VITE_GITHUB_REPO=$GITHUB_REPO
```

Replace it with:

```dockerfile
ARG COMMIT_SHA
ARG GITHUB_REPO
ARG VERSION
ENV VITE_COMMIT_SHA=$COMMIT_SHA
ENV VITE_GITHUB_REPO=$GITHUB_REPO
ENV VITE_VERSION=$VERSION
```

- [ ] **Step 2: Commit**

```bash
git add Dockerfile.frontend
git commit -m "build(frontend): accept VERSION build arg for SemVer display"
```

---

## Task 6: Write failing Footer tests

`Footer.tsx` has no test file yet. These tests drive the new version display and also document the correct (post-fix) commit URL behavior. `getEmail` is mocked to return `null` so the email span doesn't interfere.

**Files:**
- Create: `frontend/src/components/Footer.test.tsx`

- [ ] **Step 1: Create the test file**

```tsx
// frontend/src/components/Footer.test.tsx
import { render, screen } from '@testing-library/react'
import { vi, afterEach } from 'vitest'
import Footer from './Footer'

vi.mock('../api/client', () => ({ getEmail: () => null }))

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('Footer', () => {
  it('renders nothing when no sha, version, or email', () => {
    const { container } = render(<Footer />)
    expect(container.firstChild).toBeNull()
  })

  it('renders version link pointing to GitHub releases when VITE_VERSION is set', () => {
    vi.stubEnv('VITE_VERSION', '1.2.3')
    vi.stubEnv('VITE_GITHUB_REPO', 'gerrited/automate-eversports-bookings')
    render(<Footer />)
    const link = screen.getByRole('link', { name: 'v1.2.3' })
    expect(link).toHaveAttribute(
      'href',
      'https://github.com/gerrited/automate-eversports-bookings/releases/tag/v1.2.3'
    )
  })

  it('renders SHA link pointing to GitHub commit when VITE_COMMIT_SHA is set', () => {
    vi.stubEnv('VITE_COMMIT_SHA', 'abc1234567890')
    vi.stubEnv('VITE_GITHUB_REPO', 'gerrited/automate-eversports-bookings')
    render(<Footer />)
    const link = screen.getByRole('link', { name: 'abc1234' })
    expect(link).toHaveAttribute(
      'href',
      'https://github.com/gerrited/automate-eversports-bookings/commit/abc1234567890'
    )
  })

  it('renders both version and SHA separated by · when both are set', () => {
    vi.stubEnv('VITE_VERSION', '1.2.3')
    vi.stubEnv('VITE_COMMIT_SHA', 'abc1234567890')
    vi.stubEnv('VITE_GITHUB_REPO', 'gerrited/automate-eversports-bookings')
    render(<Footer />)
    expect(screen.getByRole('link', { name: 'v1.2.3' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'abc1234' })).toBeInTheDocument()
    expect(screen.getByText('·')).toBeInTheDocument()
  })

  it('renders version without link when VITE_GITHUB_REPO is absent', () => {
    vi.stubEnv('VITE_VERSION', '1.2.3')
    render(<Footer />)
    expect(screen.getByText('v1.2.3')).toBeInTheDocument()
    expect(screen.queryByRole('link')).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd frontend && npm test -- Footer.test.tsx
```

Expected: multiple failures — `Footer` does not yet render version, `·` separator, or correct link structure.

---

## Task 7: Update `Footer.tsx`

Implement version display, the `·` separator, correct commit URL (using `github.repository` format), and the release URL. Also fix the null-return guard to include version.

**Files:**
- Modify: `frontend/src/components/Footer.tsx`

- [ ] **Step 1: Replace the file content**

```tsx
import { useState, useEffect } from 'react'
import { getEmail } from '../api/client'

export default function Footer() {
  const sha = import.meta.env.VITE_COMMIT_SHA as string | undefined
  const repo = import.meta.env.VITE_GITHUB_REPO as string | undefined
  const version = import.meta.env.VITE_VERSION as string | undefined
  const [email, setEmail] = useState<string | null>(getEmail)

  useEffect(() => {
    const handler = () => setEmail(getEmail())
    window.addEventListener('auth-changed', handler)
    return () => window.removeEventListener('auth-changed', handler)
  }, [])

  if (!sha && !email && !version) return null

  const shortSha = sha?.slice(0, 7)
  const commitHref = sha && repo ? `https://github.com/${repo}/commit/${sha}` : undefined
  const versionHref = version && repo ? `https://github.com/${repo}/releases/tag/v${version}` : undefined

  return (
    <footer style={{ position: 'fixed', bottom: 0, left: 0, right: 0, textAlign: 'center', padding: '6px', fontSize: '0.7rem', color: '#9ca3af', background: '#021214', borderTop: '1px solid #0d3538', display: 'flex', justifyContent: 'center', gap: '8px' }}>
      {email && <span>Angemeldet als {email} -</span>}
      {version && (
        <span>
          {versionHref ? (
            <a href={versionHref} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
              v{version}
            </a>
          ) : `v${version}`}
        </span>
      )}
      {version && shortSha && <span>·</span>}
      {shortSha && (
        <span>
          {commitHref ? (
            <a href={commitHref} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
              {shortSha}
            </a>
          ) : shortSha}
        </span>
      )}
    </footer>
  )
}
```

- [ ] **Step 2: Run tests to confirm they pass**

```bash
cd frontend && npm test -- Footer.test.tsx
```

Expected: all 5 tests pass.

- [ ] **Step 3: Run full test suite to check for regressions**

```bash
cd frontend && npm test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Footer.tsx frontend/src/components/Footer.test.tsx
git commit -m "feat(footer): show SemVer with release link alongside commit SHA"
```

---

## Verification

After all tasks are done:

1. **CI workflow** — push a commit to `main`. In GitHub Actions, the `CI` workflow should run `tests` then `build images` (4 jobs). Images should be tagged `sha-{short}` + `latest`.

2. **Release workflow** — create and push a tag:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
   The `Release` workflow should run `tests`, `calculate version` (GitVersion outputs `1.0.0`), and `build images`. Images should be tagged `sha-{short}`, `latest`, and `v1.0.0`.

3. **Footer** — pull the `v1.0.0` frontend image. The footer should show `v1.0.0 · {sha}` with the version linking to `https://github.com/gerrited/automate-eversports-bookings/releases/tag/v1.0.0`.
