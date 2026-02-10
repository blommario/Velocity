/**
 * Viewmodel Render Layer — renders first-person weapon models in a separate scene.
 *
 * Uses R3F `createPortal` to render children into a dedicated Scene with its own
 * PerspectiveCamera (lower FOV ~70° vs gameplay ~100°). The viewmodel scene is
 * composited on top of the main scene in PostProcessing with depth cleared between
 * passes so the viewmodel always renders in front of world geometry.
 *
 * Engine component — no game store imports. Uses prop injection for all state.
 */
import { useRef, useMemo, useEffect, type ReactNode } from 'react';
import { createPortal, useThree, useFrame } from '@react-three/fiber';
import {
  Scene, PerspectiveCamera, AmbientLight, DirectionalLight,
} from 'three/webgpu';

const VIEWMODEL_DEFAULTS = {
  FOV: 70,
  NEAR: 0.01,
  FAR: 50,
  AMBIENT: 0.6,
  DIRECTIONAL: 0.8,
} as const;

export interface ViewmodelLayerProps {
  children: ReactNode;
  /** Viewmodel camera FOV. Default: 70 */
  fov?: number;
  /** Whether the viewmodel is visible. Default: true */
  visible?: boolean;
  /** Ambient light intensity multiplier (e.g. boost during inspect). Default: 1.0 */
  lightBoost?: number;
}

export interface ViewmodelSceneRef {
  scene: Scene;
  camera: PerspectiveCamera;
}

// Module-level singleton for PostProcessing to read
let _viewmodelRef: ViewmodelSceneRef | null = null;

/** Get the current viewmodel scene/camera (for PostProcessing compositing). */
export function getViewmodelScene(): ViewmodelSceneRef | null {
  return _viewmodelRef;
}

export function ViewmodelLayer({
  children,
  fov = VIEWMODEL_DEFAULTS.FOV,
  visible = true,
  lightBoost = 1.0,
}: ViewmodelLayerProps) {
  const { camera: mainCamera, size } = useThree();
  const vmCameraRef = useRef<PerspectiveCamera | null>(null);

  // Create viewmodel scene + camera once (stable across renders)
  // Register singleton ref synchronously so PostProcessing can read it
  // during its own useEffect pipeline build (same commit phase).
  const { vmScene, vmCamera, vmAmbient } = useMemo(() => {
    const scene = new Scene();
    scene.name = 'ViewmodelScene';

    const camera = new PerspectiveCamera(
      VIEWMODEL_DEFAULTS.FOV,
      1,
      VIEWMODEL_DEFAULTS.NEAR,
      VIEWMODEL_DEFAULTS.FAR,
    );

    // Add camera to scene so it participates in the scene graph.
    // Children portalled into the camera inherit its rotation automatically,
    // so viewmodel objects work in camera-local space without manual transforms.
    scene.add(camera);

    // Basic lighting for the viewmodel scene
    const ambient = new AmbientLight(0xffffff, VIEWMODEL_DEFAULTS.AMBIENT);
    scene.add(ambient);

    const directional = new DirectionalLight(0xffffff, VIEWMODEL_DEFAULTS.DIRECTIONAL);
    directional.position.set(0.5, 1, 0.3);
    scene.add(directional);

    // Set ref synchronously — PostProcessing reads this in useEffect
    _viewmodelRef = { scene, camera };

    return { vmScene: scene, vmCamera: camera, vmAmbient: ambient };
  }, []);

  vmCameraRef.current = vmCamera;

  // Update visibility + cleanup on unmount
  useEffect(() => {
    if (visible) {
      _viewmodelRef = { scene: vmScene, camera: vmCamera };
    } else {
      _viewmodelRef = null;
    }
    return () => { _viewmodelRef = null; };
  }, [visible, vmScene, vmCamera]);

  // Update FOV when prop changes
  useEffect(() => {
    vmCamera.fov = fov;
    vmCamera.updateProjectionMatrix();
  }, [vmCamera, fov]);

  // Sync viewmodel camera rotation with main camera each frame.
  // Priority 1 — runs AFTER PlayerController/physics update the main camera
  // (priority 0) but BEFORE PostProcessing renders (also priority 1, but
  // mounted later so it runs after this in same-priority order).
  useFrame(() => {
    const cam = vmCameraRef.current;
    if (!cam) return;

    // Copy rotation from main gameplay camera
    cam.quaternion.copy(mainCamera.quaternion);
    // Camera stays at origin — viewmodel objects are positioned relative to it
    cam.position.set(0, 0, 0);
    cam.updateMatrixWorld(true);

    // Update aspect ratio if canvas resized
    const aspect = size.width / size.height;
    if (Math.abs(cam.aspect - aspect) > 0.001) {
      cam.aspect = aspect;
      cam.updateProjectionMatrix();
    }

    // Update ambient light boost (e.g. for weapon inspect)
    const targetIntensity = VIEWMODEL_DEFAULTS.AMBIENT * lightBoost;
    if (Math.abs(vmAmbient.intensity - targetIntensity) > 0.01) {
      vmAmbient.intensity = targetIntensity;
    }
  }, 1);

  if (!visible) return null;

  // Portal children into the camera — they inherit camera rotation automatically,
  // so viewmodel code works in camera-local space (no manual quaternion transforms).
  return <>{createPortal(children, vmCamera as any)}</>;
}
