---
name: Tailwind v4 content-scan OOM from large binary assets
description: Why the grudge-game vite dev server got OOM-killed on startup/first-load, and the source(none) fix.
---

# Tailwind v4 scans the whole Vite root and chokes on large committed binaries

The Grudge Warlords vite dev server (`artifacts/grudge-game`) was repeatedly
kernel-OOM-killed: vite logged `ready`, then the process was silently SIGKILLed
the moment the first page (its CSS) loaded. Root cgroup memory climbed **linearly
~630MB/s from ~1.9GB to ~7GB**, independent of which HTTP routes were hit, then
dropped back after the kill.

**Root cause:** `src/index.css` used `@import "tailwindcss";` with no source
restriction. Tailwind v4's oxide scanner auto-detects content across the **entire
Vite root** and does **not** treat `.glb`/`.gltf` as binary. `public/` holds
**~335MB of un-gitignored binary GLB models** (single files up to 32MB). On first
CSS transform the scanner reads all of that model data into memory hunting for
class names → runaway → OOM.

**Fix:** bound the scan to real source files:
```css
@import "tailwindcss" source(none);
@source "../index.html";
@source "./**/*.{ts,tsx}";
```
(`@source` paths are relative to the CSS file, here `src/index.css`.)

**Why this is the durable lesson, not the other "fixes":** every earlier attempt
(excluding three/recharts/framer from `optimizeDeps`, heap caps, GOMAXPROCS,
disabling cartographer/dev-banner via REPL_ID, lazy routes) failed because the
runaway was **never in dependency optimization** — it was the CSS content scan.
A linear, steady, request-independent memory climb right after `ready` points at a
file-tree scanner reading large files, not at esbuild bundling (which is bounded
and spikes-then-plateaus).

**How to apply:** any Tailwind v4 project that commits large binary assets
(models, videos, datasets) under a Vite-root-scanned dir must use
`source(none)` + explicit `@source`, or those bytes get read on every CSS build.
When adding new template locations (new dirs with className usage outside
`src/**` or `index.html`), add an explicit `@source` for them — `source(none)`
disables the automatic fallback, so unlisted dirs are not scanned.

**Diagnosis tooling note:** on this box you cannot keep a background monitor alive
across the OOM — the bash tool reaps the process group on call end, and the cgroup
OOM killer (memory.max=8GB, no swap) kills processes in the shared workspace
cgroup. Capture to a `/tmp` file from a self-contained foreground loop, or read
`/sys/fs/cgroup/memory.current` and `/sys/fs/cgroup/memory.events` (oom_kill
counter) before/after a `restart_workflow`.
