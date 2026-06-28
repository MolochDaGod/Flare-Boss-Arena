---
name: Bloom postprocessing + tone mapping
description: Why RenderPass→UnrealBloom→OutputPass with ACES on the renderer is NOT double tone-mapping on three r152+
---

# Bloom pipeline & tone mapping

The combat scenes (dungeon/camp/arena) render through an `EffectComposer`:
`RenderPass → UnrealBloomPass → OutputPass`, while the `WebGLRenderer` keeps
`toneMapping = ACESFilmicToneMapping`. A code review flagged this as "double
tone-mapping". It is **not**, on three.js r152+ (we are on 0.184).

**Why:** In the renderer, tone mapping is only applied when rendering to the
default framebuffer. When a render target is bound (which is the case for every
pass inside the composer), `toneMapping` is forced to `NoToneMapping`
(three.module.js ~line 7548: `let toneMapping = NoToneMapping; if (currentRenderTarget === null …)`).
So `RenderPass` writes the scene **linear** into the composer target, bloom
operates in linear, and `OutputPass` reads `renderer.toneMapping` /
`renderer.outputColorSpace` and applies ACES + sRGB **exactly once** at the end
(OutputPass.js sets `ACES_FILMIC_TONE_MAPPING` define from `renderer.toneMapping`).

**How to apply:** Keep `RenderPass → bloom → OutputPass` AND leave
`renderer.toneMapping = ACESFilmicToneMapping`. Do NOT "fix" it by setting the
renderer to `NoToneMapping` — that would drop ACES entirely and wash the scene.
Do NOT add a second tone-map step. The shared helper is `combat/bloom.ts`
(`makeBloomComposer`), which returns `null` on headless/no-GPU so callers fall
back to `renderer.render`.
