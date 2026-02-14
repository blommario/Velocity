# Velocity — TODO

## ✅ Klart

- ✅ Migrerat SpeedTrail, GrappleBeam, CheckpointShimmer till node-baserade material
- ✅ Fas A1–A3: Asset pipeline (glTF loader, PBR textures, HDRI skybox)
- ✅ Laddat ner HDRI (Satara Night, Dikhololo Night) + PBR texturer (Metal009, Concrete034)
- ✅ Kenney Space Kit integrerat (153 FBX modeller) + FBXLoader tillagt
- ✅ Quaternius Modular Sci-Fi MEGAKIT — 190 glTF modeller (Walls, Platforms, Columns, Props, Decals, Aliens)
- ✅ 3dtextures.me sci-fi PBR texturer — 6 set (wall-013, wall-015, metal-panel-005/007, metal-mesh-002, metal-grill-024)
- ✅ Fas A4 komplett — alla assets nedladdade och organiserade

## 🟡 Nästa steg

- 🔲 Testa HDRI skybox i Skybreak-banan (`skybox: 'hdri:satara_night_2k.hdr'`)
- 🔲 Testa PBR-texturer på block (`textureSet: 'metal-009/metal-009'`)
- 🔲 Testa ExplosionManager (TSL compute shaders)
- 🔲 Börja Fas B: Grafik & Visuell Kvalitet
- 🔲 Börja Fas C: Physics & Movement Feel


Sammanfattning av alla fixar:

1. Kestrel WebTransport binärpatch (backend/KestrelPatcher/)

Kestrels WebTransport-implementation kräver sec-webtransport-http3-draft02-headern, men Chrome (draft-09+) skickar den inte längre
Lösning: Binärpatchade Microsoft.AspNetCore.Server.Kestrel.Core.dll med dnlib — 4 IL-patchar i ProcessHeadersFrameAsync:
NOP:ade EnableWebTransport equality-check → kastar inte vid mismatch
NOP:ade H3Datagram equality-check → samma
NOP:ade TryGetValue("sec-webtransport-http3-draft02") + version == "1"-checken → IsWebTransportRequest = true sätts alltid när protocol == "webtransport"
Bytte namn på response-headern i AcceptAsync till x-patched-unused
SETTINGS IDs rörs INTE — Chrome accepterar dom som de är
2. Transport worker reconnect-fix (engine/networking/transport.worker.ts)

reset_reconnect-handlern var trasig — transport-variabeln nollades aldrig efter failure, så reconnect försökte återanvända en död transport
Fix: cleanup() stänger och nullar transporten korrekt
3. WebTransport error-logging (engine/networking/WebTransportTransport.ts)

La till devLog.error('WebTransport', msg.message) för synlighet vid fel