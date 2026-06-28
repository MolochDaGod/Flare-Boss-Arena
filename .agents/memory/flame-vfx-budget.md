---
name: FlameVfx concurrency + light budget
description: Why FlameVfx caps concurrent bursts and point-lights, and how the fallback degrades
---

# FlameVfx budget

`combat/FlameVfx.ts` spawns a fresh group (Points geometries + materials + an
optional PointLight) per `burst()`. Two hard caps bound the worst case:

- `MAX_ACTIVE` concurrent bursts — at the cap, the oldest burst is recycled
  (disposed + shifted) before a new one spawns.
- `MAX_LIGHTS` concurrent point-lights — only the first few simultaneous bursts
  get a real `PointLight`; the rest render light-free.

**Why:** Dynamic lights are the dominant per-burst cost, and dense AoE / mob
death cascades can fire many bursts in one frame. Bloom already carries most of
the glow, so dropping the light on overflow bursts is visually cheap. `b.light`
is therefore `PointLight | null` — every read must null-check it.

**How to apply:** When adding new burst sites, just call `burst()`; do not add
your own lights or pooling. If you raise the caps, remember each active burst is
2 geometries + 4 materials, and lights compound shader cost.
