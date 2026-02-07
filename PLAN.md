# VELOCITY 2.0 — Implementation Plan

> Ny plan som ersätter v1. Alla v1-faser (1–12) betraktas som klara.
> Fokus: gameplay-djup, multiplayer, community, polish.
> ✅ = klart | 🔲 = kvar | 🔧 = pågår

---

## Fas 13 — Gameplay Feel & Physics Polish
*Finslipa det som redan finns. Grunden måste vara perfekt innan nya features.*

**Förutsättning:** v1 komplett

- 🔲 Camera-relative movement fix (getWishDir rotation convention) — **DONE i koden, behöver verifieras**
- 🔲 Variable jump height tuning — JUMP_FORCE=75, peak ≈ 3.5 units, testa att det känns rätt
- 🔲 Crouch slide polish — justera CROUCH_SLIDE_MIN_SPEED och boost för bättre slide-känsla
- 🔲 Wall run feedback — kameralutning (tilt) under wall run för tydligare visuell feedback
- 🔲 Surf polish — testa alla surf ramps, justera SURF_MIN_ANGLE/MAX_ANGLE om nödvändigt
- 🔲 Bättre landningsanimation — kort kamera-dip vid hård landing (>200 u/s fallhastighet)
- 🔲 Air control tuning — testa strafe jumping, bhop chains, verifiera att speed-gain fungerar korrekt
- 🔲 Respawn polish — fade-to-black + fade-in vid respawn istället för instant teleport
- 🔲 Kill zone feedback — röd vignette-flash vid death innan respawn

---

## Fas 14 — Vapenexpansion
*Fler vapen ger djup och strategi. Varje vapen ska ha unik movement-utility.*

**Förutsättning:** Fas 13

### 14a — Hitscan-vapen
- 🔲 Weapon switching system — siffertangenter (1–5) + scrollhjul, animerad weapon swap
- 🔲 Weapon viewmodel — enkel 3D-modell i nedre högra hörnet (first person arms/gun)
- 🔲 Sniper rifle — hitscan, 1-shot kill NPCs, zoom (right-click), liten knockback bakåt, 2s cooldown
- 🔲 Assault rifle — hitscan, snabb eldhastighet (100ms), liten knockback, spread, 30 ammo magazine
- 🔲 Shotgun — 8 pellets i kon, hög nära-skada, stor knockback (shotgun jump!), 1s pump

### 14b — Melee & Special
- 🔲 Knife/Sword — lunge forward (kort dash), no ammo, snabb attack
- 🔲 Plasma gun — kontinuerlig stråle, pushback-effekt (användbar som mini-boost)
- 🔲 Grapple upgrade — grapple hook som vapen (valfri riktning, inte bara grapple points)

### 14c — Weapon HUD
- 🔲 Weapon wheel — snabbval med mushjul eller tangent
- 🔲 Ammo display per vapen i CombatHud
- 🔲 Weapon crosshair — anpassad crosshair per vapentyp (dot, spread-ring, scope)
- 🔲 Muzzle flash + impact particles per vapen

---

## Fas 15 — Visuell Upgrade
*Höj den visuella kvaliteten markant. WebGPU-features som skiljer oss från andra.*

**Förutsättning:** Fas 13

### 15a — Lighting & Atmosphere
- 🔲 Dynamisk skybox — procedurell himmel med sol/måne-position, moln (TSL shader)
- 🔲 Volumetric fog — riktig volumetrisk dimma i dalgångar och near ground (compute shader)
- 🔲 Point lights — dynamiska ljuskällor vid boost pads, speed gates, ammo pickups (emissive glow)
- 🔲 Baked ambient occlusion — SSAO post-process pass via TSL
- 🔲 Reflections — screen-space reflections på metalliska/glansiga ytor
- 🔲 Shadow quality — cascaded shadow maps för bättre skuggor på stora banor

### 15b — Effekter & Particles
- 🔲 Trail effect — hastighetsbaserad trail bakom spelaren vid >400 u/s
- 🔲 Explosion particles — riktig partikelexplosion vid raket/granat-impact (GPU compute)
- 🔲 Wall run sparks — partikeleffekt vid väggkontakt under wall run
- 🔲 Speed gate whoosh — visuell distortion-ring när man passerar speed gate
- 🔲 Grapple beam — synlig lina/stråle från spelare till grapple point
- 🔲 Checkpoint shimmer — partikeleffekt vid checkpoint-passage
- 🔲 Water/lava surfaces — animated shader-ytor för kill zones / dekorativa element

### 15c — UI & HUD Polish
- 🔲 Animated transitions — slide/fade vid screen-byte (meny → spel → resultat)
- 🔲 Damage indicator — riktningsbaserad röd arc på skärmen vid skada
- 🔲 Kill feed — visa senaste events (checkpoint, kill, death) i övre högra hörnet
- 🔲 Minimap — valfri minimap för stora/komplexa banor
- 🔲 Crosshair customization — fullständig anpassning (stil, färg, size, opacity) kopplad till settings

---

## Fas 16 — Banor 2.0
*Fler och bättre banor. Community-verktyg för att upptäcka community maps.*

**Förutsättning:** Fas 15 (nya visuella features) + Fas 14 (nya vapen)

### 16a — Nya officiella banor
- 🔲 **"Frostbite"** (Medium) — Istema, hala ytor (låg friktion), grottgångar, frostdimma
- 🔲 **"Molten Core"** (Hard) — Lava-tema, rörliga plattformar över lava, stigande lava-timer
- 🔲 **"Orbital"** (Expert) — Rymdstation, låg gravitation, zero-G-sektioner, glaskorridorer
- 🔲 **"Vertigo"** (Hard) — Extremt vertikalt, spiraltorn, grapple-chains, inget golv
- 🔲 **"Speedway"** (Medium) — Ren hastighets-bana, boost pad chains, minimal hinder, WR-fokus
- 🔲 **"Labyrinth"** (Hard) — Labyrint med rörliga väggar, multiple paths, route-finding
- 🔲 **"Aether"** (Expert) — Alla mekaniker, ultra-tight timing, <1% clear rate designmål

### 16b — Map Editor v2
- 🔲 Prefabs — sparade block-grupper som kan återanvändas
- 🔲 Terrain brush — skulptera terräng istället för bara boxar
- 🔲 Custom textures — ladda upp texturer för block
- 🔲 Trigger zones — scriptbara events (visa text, öppna dörr, ändra gravitation)
- 🔲 Decorations — icke-kolliderande visuella objekt (träd, lampor, skyltar)
- 🔲 Map thumbnails — auto-screenshot vid publicering
- 🔲 Versionshantering — spara revisioner, rollback till tidigare version

### 16c — Community Browser
- 🔲 Map rating — 1–5 stjärnor + likes
- 🔲 Tags — difficulty, style (speed, puzzle, combat, technical), theme
- 🔲 Sökfilter — efter namn, skapare, difficulty, rating, senaste
- 🔲 Featured maps — kuraterad "Editors Pick" sektion
- 🔲 Download count — visa popularitet
- 🔲 Comment system — feedback på community maps

---

## Fas 17 — Live Multiplayer
*Faktisk real-time multiplayer. Största featuren i v2.0.*

**Förutsättning:** Fas 13 (polerad fysik)

### 17a — Race System Completion
- 🔲 Live position broadcasting — skicka position via SSE med 20Hz, interpolera på klienten
- 🔲 Ghost rendering under race — andra spelare som semi-transparenta kapslar (ingen kollision)
- 🔲 Live standings panel — visa alla spelare sorterade efter checkpoint-progress + tid
- 🔲 Race finish — slutresultat för alla deltagare, vänta på alla eller timeout
- 🔲 Race chat — enkel textchat i lobby och under race
- 🔲 Spectator mode — titta på pågående race utan att delta

### 17b — Matchmaking
- 🔲 ELO-system — rating baserat på average finish percentile per bana
- 🔲 Quick match — matcha med spelare på liknande ELO, slumpad official map
- 🔲 Ranked seasons — veckovis rotation av 3 banor, säsongs-leaderboard
- 🔲 Casual vs Ranked — separata köer, ranked har ELO-påverkan
- 🔲 Queue UI — sökindikator, estimated wait time, cancel-knapp

### 17c — Socialt
- 🔲 Friends list — lägg till/ta bort vänner, se online-status
- 🔲 Friend invites — bjud in vänner till race room direkt
- 🔲 Activity feed — "X slog nytt PB på Cliffside", "Y joinade Neon District race"
- 🔲 Player profiles v2 — avatar, titel, favoritbana, trophy cabinet
- 🔲 Achievements — 50+ achievements (first clear, sub-par clear, 1000 jumps, etc.)

---

## Fas 18 — Game Modes
*Bortom time trial. Nya sätt att spela ger replayability.*

**Förutsättning:** Fas 17a (live multiplayer)

- 🔲 **Elimination** — 8 spelare, långsammaste varje runda elimineras, 4 rundor
- 🔲 **Tag/Infection** — en "it"-spelare jagar andra, touch = infect, siste överlevande vinner
- 🔲 **Relay Race** — 2–4 lag, varje spelare springer en sektion av banan
- 🔲 **Time Attack Challenge** — daglig/veckovis challenge, alla kör samma bana, global leaderboard
- 🔲 **Practice Mode v2** — checkpoint-restart, segment-timer, slow-mo, noclip
- 🔲 **Tutorial Mode** — interaktiv tutorial med guidade steg, tip-popups, visuella guider

---

## Beroendeöversikt v2.0

```
v1 Komplett (Fas 1–12)
├── Fas 13 (Gameplay Feel) ← STARTPUNKT
│   ├── Fas 14 (Vapenexpansion)
│   ├── Fas 15 (Visuell Upgrade)
│   │   └── Fas 16 (Banor 2.0) ← kräver även Fas 14
│   ├── Fas 17 (Live Multiplayer)
│   │   └── Fas 18 (Game Modes)
│   └── (Ljud — ingår i Fas 15c som polish)
```

**Rekommenderad prioritet (implementeringsordning):**
1. Fas 13 — Gameplay Feel (fix + polish det som finns)
2. Fas 15a+c — Visuell polish + HUD (synliga förbättringar)
3. Fas 14 — Vapen (gameplay-djup)
4. Fas 17a — Live multiplayer race loop
5. Fas 16a — Nya banor
6. Fas 17b+c — Matchmaking + socialt
7. Fas 18 — Game modes
