# CI/CD Workflows

## Overview

This repository uses GitHub Actions for automated testing and publishing.

## Workflows

### 1. PR Checks (`pr-checks.yml`)

**Trigger:** Pull requests to `main` or `dev`

Validates code before merge:

- Code quality (lint, type check)
- TypeScript SDK tests (if version changed)
- Python SDK tests (if version changed)
- Security scan (Trivy)

**Blocks merge if any check fails.**

### 2. Publish (`publish.yml`)

**Trigger:** Push to `main` branch

Automatically publishes SDKs when versions change:

- TypeScript SDK → npm (`@getmemoir/sdk`)
- Python SDK → PyPI (`memoir`)
- Create Memoir Memories wizard → npm

### 3. Documentation (`jekyll-gh-pages.yml`)

**Trigger:** Push to `main` branch

Deploys documentation site to GitHub Pages.

## Release Process

### Bump version → Create PR → Merge = Auto-publish ✅

**TypeScript SDK:**

```bash
npm version minor
git add package.json package-lock.json
git commit -m "chore: bump version to 0.9.2"
# Create PR, merge to main = auto-publish
```

**Python SDK:**

```bash
# Edit memoir-sdk-python/pyproject.toml version
git add memoir-sdk-python/pyproject.toml
git commit -m "chore: bump Python SDK to 0.9.2"
# Create PR, merge to main = auto-publish
```

## Required Secrets

Configure in Settings → Secrets and variables → Actions:

| Secret | Required | Purpose |
|--------|----------|---------|
| `CONVEX_URL` | Yes | Convex deployment URL (e.g. `https://your-project.convex.cloud`) |
| `CONVEX_DEPLOY_KEY` | Yes | Deploy key from Convex dashboard → Settings → Deploy Key |
| `NPM_TOKEN` | Recommended | npm automation token for `@getmemoir` packages |

The Publishing workflow validates these secrets before attempting deploy or publish.
If they are missing, the workflow fails immediately with setup instructions.

### Getting Convex credentials (free tier)

1. Create a project at [dashboard.convex.dev](https://dashboard.convex.dev)
2. Copy your deployment URL → `CONVEX_URL`
3. Settings → Deploy Key → create key → `CONVEX_DEPLOY_KEY`
4. Re-run **Actions → Publishing → Run workflow**

## PyPI Trusted Publishing

Python SDK uses trusted publishing (no token needed). Configure in PyPI project settings:

- Publisher: GitHub
- Repository: `Anu-Code07/memoir`
- Workflow: `publish.yml`
- Environment: `pypi`
