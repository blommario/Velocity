# Velocity — TODO

## 🔴 KRITISK: Fixa grön tint i WebGPU-rendering

Hela 3D-scenen renderas med stark grön färgkast. Se CLAUDE.md → "Green Tint Bug" för fullständig analys.

### Nuläge
- `GameCanvas.tsx` har `linear` + `flat` på Canvas — bas-rendering utan PostProcessing har korrekta färger
- `PostProcessingEffects.tsx` använder `PostProcessing`-klassen med `outputColorTransform = false` + `renderOutput(combined, ACESFilmicToneMapping, SRGBColorSpace)`
- När PostProcessingEffects är aktiv återkommer grön tint

### Steg-för-steg felsökning (gör i denna ordning)

- 🔲 **Steg 1: Verifiera bas-rendering utan PostProcessing**
  - Kommentera ut `<PostProcessingEffects />` i `GameCanvas.tsx`
  - Ladda om → bekräfta att färger är korrekta med `linear` + `flat` (mörkt men utan grön tint)
  - Om fortfarande grönt: problemet är INTE i PostProcessing utan i WebGPURenderer själv

- 🔲 **Steg 2: Testa PostProcessing med ENBART pass-through (ingen bloom/vignette/renderOutput)**
  - I `PostProcessingEffects.tsx`, ändra `pipeline.outputNode` till bara `scenePassColor` (ingen bloom, vignette, renderOutput)
  - Behåll `outputColorTransform = true` (låt PostProcessing-klassen sköta tonemapping/sRGB automatiskt)
  ```tsx
  pipeline.outputColorTransform = true;  // AUTO tonemapping + sRGB
  const scenePass = pass(scene, camera);
  pipeline.outputNode = scenePass.getTextureNode('output');
  ```
  - Om grönt: `pass()` + `PostProcessing` pipeline orsakar problemet
  - Om OK: problemet sitter i bloom/vignette/renderOutput noder

- 🔲 **Steg 3: Lägg till renderOutput utan bloom/vignette**
  ```tsx
  pipeline.outputColorTransform = false;
  const scenePassColor = scenePass.getTextureNode('output');
  pipeline.outputNode = renderOutput(scenePassColor, ACESFilmicToneMapping, SRGBColorSpace);
  ```
  - Om grönt: `renderOutput()` med explicit `SRGBColorSpace` orsakar dubbelkonvertering
  - Om OK: problemet sitter i bloom/vignette-noderna

- 🔲 **Steg 4: Testa bloom utan vignette, sedan vignette utan bloom**
  - Isolera vilken post-processing-nod som triggar grön tint

- 🔲 **Steg 5: Undersök dual-package-hazard**
  - Kör i browser-konsolen: kontrollera om `three` och `three/webgpu` delar samma `ColorManagement`-singleton
  - Om de har separata instanser kan `workingColorSpace` vara olika → dubbelkonvertering
  ```js
  import { ColorManagement } from 'three';
  import { ColorManagement as CM2 } from 'three/webgpu';
  console.log(ColorManagement === CM2); // BÖR vara true
  ```

- 🔲 **Steg 6: Testa alternativ PostProcessing-approach**
  - Istället för `PostProcessing`-klassen, använd `renderer.setRenderTarget()` + manuell quad-render
  - Se Three.js official bloom-example: `threejs.org/examples/webgpu_postprocessing_bloom.html`
  - Jämför deras setup med vår — de använder `outputColorTransform = true` (default)

- 🔲 **Steg 7: Överväg Three.js-uppgradering**
  - r183 renamear `PostProcessing` → `RenderPipeline` och kan ha fixat color management-buggar
  - Kör `npm ls three` för nuvarande version, testa med senaste

### Filer att redigera
| Fil | Roll |
|-----|------|
| `frontend/src/components/game/GameCanvas.tsx` | Canvas-props (`linear`, `flat`), vilka komponenter som renderas |
| `frontend/src/components/game/PostProcessingEffects.tsx` | PostProcessing pipeline, renderOutput, bloom/vignette |
| `frontend/src/setup-webgpu.ts` | `extend(THREE)` från `three/webgpu` |

### Kontext
- Three.js: 0.182.0
- R3F: 9.5.0
- @react-three/rapier: 2.2.0
- Canvas format: `bgra8unorm`
- GPU backend: `WebGPUBackend` (Chrome)

---

## 🟡 Mindre uppgifter

- 🔲 Ta bort `window.__renderer` debug-referens från `GameCanvas.tsx` (rad 69) efter att grön tint är fixad
- 🔲 Verifiera att SpeedTrail (`LineBasicMaterial`), GrappleBeam (`LineBasicMaterial`), CheckpointShimmer (`PointsMaterial`) fungerar korrekt med WebGPU — dessa använder legacy material-klasser
- 🔲 Testa ExplosionManager (TSL compute shaders) — bekräfta att GPU-partiklarna fungerar
- 🔲 Uppdatera Plan.md fas 15 status baserat på resultat
