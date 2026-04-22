# GitVersion Image-Tagging & Footer-Versionsanzeige

**Datum:** 2026-04-20  
**Status:** Genehmigt

## Ziel

GitVersion zur Erzeugung semantischer Versions-Tags für Container-Images verwenden. Nur git-getaggte Commits (`v*`) erhalten einen SemVer-Tag. Alle Commits auf `main` erhalten weiterhin `latest`. Der Frontend-Footer zeigt sowohl die semantische Version (verlinkt zum GitHub-Release) als auch den Commit-SHA (verlinkt zum Commit).

## Branching-Strategie

GitHub Flow: `main` + Feature-Branches. Git-Tags sind die einzige Quelle für Release-Versionen. Keine Pre-Release-Suffixe für nicht getaggte Commits.

## Dateiänderungen

```
GitVersion.yml                             # neu — GitVersion-Konfiguration
.github/workflows/docker.yml               # umbenannt → ci.yml
.github/workflows/ci.yml                   # umbenannt aus docker.yml — unverändertes Verhalten
.github/workflows/release.yml              # neu — Tag-getriggerter Release-Workflow
.github/workflows/build-images.yml         # neu — wiederverwendbarer Build-Workflow
frontend/src/components/Footer.tsx         # aktualisiert — Version + SHA anzeigen
Dockerfile.frontend                        # aktualisiert — VERSION Build-Arg akzeptieren
```

## GitVersion-Konfiguration (`GitVersion.yml`)

```yaml
mode: ContinuousDelivery
branches:
  main:
    is-mainline: true
    increment: Patch
```

Tags sind die Quelle der Wahrheit. Ein Tag `v1.2.0` auf `main` veranlasst GitVersion, `1.2.0` auszugeben. Kein Pre-Release-Suffix — nicht getaggte Builds erhalten keinen SemVer-Image-Tag.

## Wiederverwendbarer Workflow (`.github/workflows/build-images.yml`)

Ausgelöst via `workflow_call`. Inputs:

| Input | Typ | Pflicht | Beschreibung |
|---|---|---|---|
| `version` | string | nein | SemVer-String (z.B. `1.2.3`). Wenn gesetzt, werden Images zusätzlich zu `latest` mit `v{version}` getaggt. |

Die vier Build-Jobs (cronjob, backend, worker, frontend) sind hier definiert und werden zwischen `ci.yml` und `release.yml` geteilt. Keine Duplikation.

Für den Frontend-Job wird `VERSION` als zusätzliches `build-arg` neben dem bestehenden `COMMIT_SHA` übergeben.

Erzeugte Image-Tags:

| Aufrufer | Gepushte Tags |
|---|---|
| `ci.yml` (Push auf main) | `latest`, `sha-{short}` |
| `release.yml` (Push Tag `v*`) | `v{semver}`, `latest`, `sha-{short}` |

## CI-Workflow (`.github/workflows/ci.yml`)

- Trigger: `push: branches: [main]`
- Schritte: Tests ausführen → `build-images.yml` ohne `version`-Input aufrufen
- Umbenannt aus `docker.yml`; Verhalten unverändert

## Release-Workflow (`.github/workflows/release.yml`)

- Trigger: `push: tags: ['v*']`
- Schritte:
  1. `actions/checkout@v4` mit `fetch-depth: 0` (GitVersion benötigt vollständige History)
  2. `gittools/actions/gitversion/setup@v3` — installiert GitVersion
  3. `gittools/actions/gitversion/execute@v3` — gibt `semVer` aus (z.B. `1.2.3`)
  4. Tests ausführen
  5. `build-images.yml` mit `version: ${{ steps.gitversion.outputs.semVer }}` aufrufen

## Frontend Dockerfile

```dockerfile
ARG COMMIT_SHA
ARG VERSION
ENV VITE_COMMIT_SHA=$COMMIT_SHA
ENV VITE_VERSION=$VERSION
```

Beide Args sind optional. Wenn `VERSION` fehlt (CI-Builds), ist `VITE_VERSION` leer und der Footer lässt den Versionslink weg.

## Frontend Footer

`Footer.tsx` liest:
- `VITE_VERSION` → anzeigen als `v1.2.3`, verlinkt auf `https://github.com/{repo}/releases/tag/v{version}`
- `VITE_COMMIT_SHA` → anzeigen als kurzer SHA (7 Zeichen), verlinkt auf den Commit (bestehendes Verhalten)

Anzeigeformat wenn beide vorhanden:
```
v1.2.3 · a3f2c1b
```

Wenn nur SHA verfügbar (CI-Builds ohne Tag):
```
a3f2c1b
```

Der Footer wird ausgeblendet, wenn weder Version noch SHA noch E-Mail verfügbar sind (bestehendes Verhalten bleibt erhalten).

## Nicht im Scope

- Automatischer Versionsinkrement via Commit-Message-Konventionen (Conventional Commits)
- Pre-Release-Image-Tags für nicht getaggte Commits
- Änderungen an Backend-, Worker- oder Cronjob-Containern über das Image-Tagging hinaus
