# Grudge Multiplayer Server (Socket.IO)

Browser Three.js multiplayer — **not Mirror** (Unity C# only).

Pattern mirrors [three-player-controller multiplayer-gltf](https://github.com/hh-hang/three-player-controller):
rooms, GLTF avatars by URL, transform snapshots, combat hits, kill feed, scoreboard, chat.

## Rooms

| Kind | Room name | Purpose |
|------|-----------|---------|
| PvE | `pve:{instanceId}` | Co-op Dark Elf camp / dungeon clear |
| PvP | `arena:{matchId}` | Free-for-all or team arena |

`instanceId` matches `unityInstances.ts` (e.g. `dark_elf_camp`, `dungeon_catacombs`).

## Run

```bash
# from monorepo root
pnpm --filter @workspace/mp-server dev
# default http://localhost:4100
```

Env:

```
MP_PORT=4100
MP_CORS_ORIGIN=*
MP_TICK_HZ=20
```

## Best practices implemented

1. **Authoritative HP / kills** — clients send `fire` + hits validated server-side (range + rate limit).
2. **20 Hz snapshots** — full player transform pack; clients interpolate.
3. **Input seq** — stored for future reconciliation.
4. **Room caps** — from instance maxPlayers / arena seats.
5. **Kill feed + scoreboard** — Tab-style data via `scoreboard` events.
6. **Protocol version gate** — reject mismatched clients.

## Client

```ts
import { MultiplayerClient } from "@/net/MultiplayerClient";
const mp = new MultiplayerClient({ url: "http://localhost:4100" });
await mp.connect({ name: "Hero", modelUrl: "…/WK_Characters.glb" });
await mp.joinPve("dark_elf_camp");
// or mp.joinArena("quickmatch");
```
