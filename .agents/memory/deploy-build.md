---
name: deploy build path & vite OOM
description: How Replit deploy builds this monorepo, and the grudge-game vite-build heap-OOM gotcha
---

# Deployment build path

- Replit autoscale (cloud_run) deploys build each artifact via its own
  `.replit-artifact/artifact.toml` → `[services.production].build`, NOT the root
  `pnpm run build`. `.replit`'s `[deployment].build` is only a repo-root pre-build hook.
- An artifact with no `[services.production]` section (e.g. the dev-only `mockup-sandbox`
  Canvas) is never built during deploy — so its build failing locally is NOT a deploy blocker.
- Consequence: to debug a deploy build failure, reproduce the *artifact's* production build
  command, not the workspace root build. Pull authoritative logs via `listDeploymentBuilds` /
  `getDeploymentBuild` (deployment-failure-debugging reference).

# grudge-game vite build heap OOM

**Symptom:** deploy build dies silently right at rollup `transforming...` (no error line
captured); locally the build node process is SIGKILLed (exit 137) mid-transform.

**Cause:** `vite build` exhausts Node's default ~2.2GB V8 old-space heap during the rollup
transform. The app is large (Three.js + many scenes + big module graph). A build that
succeeded before can start failing purely from app growth, with no code error.

**Fix:** raise the heap in grudge-game's `build` script:
`NODE_OPTIONS=--max-old-space-size=4096 vite build ...`. If it still OOMs, escalate to 6144.

**Why:** matches exit-137 / silent-transform-death signature; default heap is the bottleneck,
not host RAM (local cgroup is 8GB with GBs free when the kill happens).

**How to apply:** if any vite-built artifact's deploy build dies at `transforming...` or with
exit 137, bump `--max-old-space-size` first before hunting for a code-level cause.

# Local build verification caveat

This dev environment's watchdog kills heavyweight agent-spawned node processes (full vite
builds) within ~90s, so a full production build often cannot be run to completion locally.
Plain long-running shell calls (e.g. `sleep`) survive — only heavy build processes are reaped.
Treat the cloud build (and its logs) as the authoritative verification surface.
