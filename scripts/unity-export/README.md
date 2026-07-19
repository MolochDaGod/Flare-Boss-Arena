# Unity → GLB export path (uMMORPG Dark Elf Camp + Dungeons)

## Why this exists

Browser Three.js cannot load Unity `.prefab` files. Export them once to **GLB**
(with textures embedded or side-by-side) and register them in
`artifacts/grudge-game/src/data/unityInstances.ts`.

**Mirror** is for Unity C# clients only. The web client uses **Socket.IO**
(Node) in the same spirit as
[three-player-controller multiplayer-gltf](https://github.com/hh-hang/three-player-controller)
(rooms · player transforms · combat events · kill feed).

## Source (FRESH-GRUDGE)

| Prefab | Unity path |
|--------|------------|
| Dark Elf Camp | `Assets/uMMORPG/Prefabs/Entities/Monsters/Dark Elf Camp/` |
| Dark Elf Encampment | `…/Dark Elf Encampment/` |
| Dark Elf Stronghold | `…/Dark Elf Stronghold/` |
| Dark Elf Castle | `Assets/uMMORPG/Prefabs/Dungeons/Dark Elf Castle*.prefab` |
| Catacombs, Cave, Mines, Temple, Ice, Lava, Forest, Portal… | `Assets/uMMORPG/Prefabs/Dungeons/` / `Entities/Monsters/*` |

Default env:

```bat
set UNITY_PROJECT=D:\repos\FRESH-GRUDGE
set UNITY_EXE=C:\Program Files\Unity\Hub\Editor\2022.3.XX\Editor\Unity.exe
set GLB_OUT=%CD%\artifacts\grudge-game\public\models\unity
```

## One-shot export (Editor menu)

1. Open `FRESH-GRUDGE` in Unity.
2. Install **UnityGLTF** or **glTFast** (or Khronos UnityGLTF exporter).
3. Copy `Editor/GrudgeUnityGlbExporter.cs` into
   `Assets/Editor/GrudgeUnityGlbExporter.cs`.
4. Menu: **Grudge → Export → Dark Elf Camp + Dungeons → GLB**
5. Output lands under `public/models/unity/` matching `unityInstances.ts` ids.

## Batchmode (CI / headless)

```bat
scripts\unity-export\export-unity-glb.bat
```

or:

```bash
node scripts/unity-export/export-unity-glb.mjs
```

If Unity is missing, the script still writes the **manifest** and copies any
already-exported GLBs into the game public folder.

## Post-export checklist (game-ready)

- [ ] Y-up, meters (scale root ≈ 1 character = 1.7–2.0 m)
- [ ] Meshes have materials (PBR); textures power-of-two when possible
- [ ] No missing materials (magenta)
- [ ] Colliders exported as optional `*_collision` children (or generate nav later)
- [ ] File size: camp &lt; 25 MB, dungeon module &lt; 40 MB preferred
- [ ] Register / verify id in `unityInstances.ts`
- [ ] `pnpm --filter @workspace/grudge-game run build` loads without 404

## Runtime slots

| Id | Three.js consumer |
|----|-------------------|
| `dark_elf_camp` | `DarkElfCamp.ts` → `DARK_ELF_CAMP_PREFAB_URL` |
| `dark_elf_encampment` | dungeon instance pool |
| `dark_elf_stronghold` | dungeon instance pool |
| `dungeon_*` | `UnityInstanceLoader` + MP PvE rooms |

## Multiplayer

See `artifacts/mp-server/README.md` — Socket.IO rooms:

- `pve:{instanceId}` — co-op dungeon / camp clear
- `arena:{matchId}` — ranked/casual PvP (best practices below)

### Net best practices (browser)

1. **Authoritative server** for damage, deaths, scores; client predicts movement.
2. **Tick rate** 20 Hz snapshots; 30–60 Hz input if needed.
3. **Interest management** — only broadcast nearby players in large PvE maps.
4. **Delta compression** — send `pos/rot/vel` quantised; full state on join.
5. **Reconciliation** — last processed input sequence on server ACKs.
6. **Security** — never trust client damage; rate-limit shots.
7. Prefer **Socket.IO** over Mirror for web; keep Mirror for native Unity clients if needed, share **protocol schema** (`shared/netProtocol.ts`).
