- [Bloom pipeline + tone mapping](bloom-pipeline-tonemapping.md) — RenderPass→bloom→OutputPass + ACES on renderer is NOT double tone-mapping on three r152+; keep it, don't "fix" it.
- [FlameVfx budget](flame-vfx-budget.md) — combat flame bursts cap concurrency + point-lights; `b.light` is nullable, overflow bursts render light-free.
- [Tailwind v4 content-scan OOM](tailwind-v4-content-scan-oom.md) — dev-server OOM = Tailwind v4 scanning huge GLBs in public/; fix is `source(none)` + explicit `@source`.
- [SkillVfx shared-clone disposal](skill-vfx-shared-clone-disposal.md) — short-lived GLB VFX share geometry/materials across clones; only templates dispose (and must dispose textures + late-loads).
- [KayKit characters are NPCs only](kaykit-characters-npc-only.md) — KayKit hero GLBs are townsfolk/NPCs (Townsfolk.ts), never the player; player skin-load failure falls back to a capsule, Dungeon to the race model.
- [ARPG skill/combat framework](combat-skill-framework.md) — scene-agnostic combat layer (shapes/telegraphs/deployables/particles); three.quarks QVector gotcha; Arena `skillTelegraphs` rename.
- [Boss model resolver](boss-model-resolver.md) — no Boss GLBs exist; AI `assetPack` maps to shipped monster GLBs by keyword then deterministic hash, tier fallback.

- [Animated-only enemy routing](animated-enemy-routing.md) — every dungeon enemy must render as an animated GLB; createEnemyModel placeholder is a defensive fallback only; dispose by model.kit/isGLB not template.id.
