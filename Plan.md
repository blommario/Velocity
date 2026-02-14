
## Fas — WebTransport Protocol Fixes + MessagePack

### Phase A: Protocol Bug Fixes
- ✅ Stream type byte handshake — fix race condition (client sends 0x01/0x02 on stream open, server reads to route)
- ✅ Snapshot unicast — send room_snapshot only to new player, not broadcast
- ✅ Abort code constants — replace magic `session.Abort(256)` with named constants
- ✅ Resource disposal — ensure `DisposeAsync()` on all early-exit paths
- ✅ Update WebTransportPlayerConnection doc comment

### Phase B: MessagePack Migration
- ✅ Install MessagePack packages (backend NuGet + frontend npm)
- ✅ Backend: Replace JSON serialization with MessagePack in Room.cs
- ✅ Backend: Rename `SendJsonFrameAsync` → `SendControlFrameAsync` (IPlayerConnection + impl)
- ✅ Frontend: Replace JSON.stringify/parse with msgpack encode/decode in transport.worker.ts
- ✅ Keep 0x80 (JSON) fallback on frontend during transition

### Phase C: Eliminate Magic Strings — MultiplayerStatus
- ✅ Export `MultiplayerStatus` union type + `MULTIPLAYER_STATUS` const from multiplayerStore
- ✅ Replace magic strings in multiplayerStore.ts set() calls
- ✅ Replace magic strings in RemotePlayers.tsx, MultiplayerLobby.tsx, RoomLobby.tsx, cameraTick.ts
