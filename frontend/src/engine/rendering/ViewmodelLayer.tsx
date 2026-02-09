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
}: ViewmodelLayerProps) {
  const { camera: mainCamera, size } = useThree();
  const vmCameraRef = useRef<PerspectiveCamera | null>(null);

  // Create viewmodel scene + camera once (stable across renders)
  const { vmScene, vmCamera } = useMemo(() => {
    const scene = new Scene();
    scene.name = 'ViewmodelScene';

    const camera = new PerspectiveCamera(
      VIEWMODEL_DEFAULTS.FOV,
      1,
      VIEWMODEL_DEFAULTS.NEAR,
      VIEWMODEL_DEFAULTS.FAR,
    );

    // Basic lighting for the viewmodel scene
    const ambient = new AmbientLight(0xffffff, VIEWMODEL_DEFAULTS.AMBIENT);
    scene.add(ambient);

    const directional = new DirectionalLight(0xffffff, VIEWMODEL_DEFAULTS.DIRECTIONAL);
    directional.position.set(0.5, 1, 0.3);
    scene.add(directional);

    return { vmScene: scene, vmCamera: camera };
  }, []);

  vmCameraRef.current = vmCamera;

  // Register/unregister singleton ref
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

  // Sync viewmodel camera rotation with main camera each frame
  useFrame(() => {
    const cam = vmCameraRef.current;
    if (!cam) return;

    // Copy rotation from main gameplay camera
    cam.quaternion.copy(mainCamera.quaternion);

    // Update aspect ratio if canvas resized
    const aspect = size.width / size.height;
    if (Math.abs(cam.aspect - aspect) > 0.001) {
      cam.aspect = aspect;
      cam.updateProjectionMatrix();
    }
  });

  if (!visible) return null;

  // createPortal renders children into the viewmodel scene
  return <>{createPortal(children, vmScene)}</>;
}
