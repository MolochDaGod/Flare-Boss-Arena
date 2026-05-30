---
name: KayKit Pirate Kit asset traits
description: How the KayKit Pirate Kit gltf assets differ from the KayKit character GLBs (animation/self-containment), so future integrations pick the right loader path.
---

# KayKit Pirate Kit (`piratesrts` zip) asset traits

The Pirate Kit characters and props are **SELF-CONTAINED `.gltf`** files:
embedded buffer (data URI) + embedded textures + **their OWN embedded animation
clips**. Characters ship 14–15 clips each (Idle, Walk, Run, Sword, Punch,
HitReact, Death, Wave, Jump*, Duck, No, Yes); Shark=3, Tentacle=4. Ships/docks/
props are single-node, self-contained.

**Why this matters:** This is the OPPOSITE of the KayKit *Character* pack
(Skeletons/Adventurers), whose GLBs are RIGGED BUT CLIP-LESS and must borrow the
shared KayKit animation-library GLBs. So:
- Pirate characters animate **natively** — one `AnimationMixer` per character
  plays its embedded clips by name. Do NOT route them through the shared anim
  library.
- The pirate rig uses **Capitalised** bone names (`Hips`, `UpperArm.L`, `Root`,
  `CharacterArmature`), which do NOT match the lowercase KayKit anim-library rig.
  Irrelevant for pirates (embedded clips), but it means you can't cross-play
  pirate clips on KayKit characters or vice-versa without retargeting.

**How to apply:** When integrating a new KayKit-style pack, first check
`animations.length` per character. >0 ⇒ native-clip path (like `PirateNPC.ts`);
0 ⇒ clip-less, needs a matching shared anim-library with identical bone names
(like `KayKitCharacter.ts`).
