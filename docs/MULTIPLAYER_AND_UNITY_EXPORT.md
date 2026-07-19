# Multiplayer + Unity GLB export

## Architecture choice: Socket.IO (not Mirror)

| Stack | Use case |
|-------|----------|
| **Mirror** | Unity C# clients only (your uMMORPG desktop build) |
| **Socket.IO + Node** | Browser Three.js (Flare / grudge-game) — same *role* as [three-player-controller multiplayer-gltf](https://github.com/hh-hang/three-player-controller) |

Web multiplayer lives in:

- Protocol: `lib/net-protocol`
- Server: `artifacts/mp-server` (`pnpm mp:dev` → `:4100`)
- Client: `artifacts/grudge-game/src/net/MultiplayerClient.ts`

### Rooms

- **PvE** `pve:{instanceId}` — co-op clear of Unity-exported camp/dungeon
- **PvP** `arena:{matchId}` — free-for-all, authoritative HP, kill feed data

### Best practices (implemented)

1. Authoritative damage / kills (rate-limited hitscan)
2. 20 Hz transform snapshots
3. Room capacity from instance registry
4. Protocol version gate
5. Scoreboard + kill events for HUD/kill-feed

Client predicts local movement; remotes interpolate snapshots.

---

## Unity → GLB (Dark Elf Camp + dungeons)

### Source

`D:\repos\FRESH-GRUDGE\Assets\uMMORPG\Prefabs\…`

- Dark Elf Camp / Encampment / Stronghold
- Dark Elf Castle (+ Lv1)
- Catacombs, Dungeon, Sewer, Stronghold, Underground ruins, Entrance

### Export

```bat
REM Status + manifest (no Unity required)
pnpm unity:export

REM Copy Editor script + batchmode when UNITY_EXE is set
pnpm unity:export:batch
```

Or in Unity Editor after copying  
`scripts/unity-export/Editor/GrudgeUnityGlbExporter.cs` →  
`Assets/Editor/GrudgeUnityGlbExporter.cs`:

**Grudge → Export → Dark Elf Camp + Dungeons → GLB**

Output: `artifacts/grudge-game/public/models/unity/{id}.glb`

### Runtime slot

`dark_elf_camp` → `DarkElfCamp.ts` / `darkElfCampPrefabUrl()`  
Loader: `UnityInstanceLoader.ts`  
Catalog: `data/unityInstances.ts`

Until GLB exists, camp falls back to themed orc atlas + `dark_elf.glb` sentries.

### Manifest

After export, `public/models/unity/manifest.json` lists prefab presence + glb readiness.
