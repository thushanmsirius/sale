# sale

## GitHub Pages deployment

In **Settings → Pages → Build and deployment**, set **Source** to
**GitHub Actions**. This replaces the automatic branch-based deployment with
the workflow in `.github/workflows/pages.yml`.

The workflow publishes the static files directly from the repository root on
pushes to `main`, or manually via **Actions → Deploy static site to Pages → Run
workflow**. No build step is required.

Deployments share the `pages` concurrency group with `cancel-in-progress: false`
so a new run waits for the active run instead of attempting an overlapping Pages
deployment. Let any existing branch-based deployment finish before running the
new workflow.