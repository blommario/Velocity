/**
 * RTS camera controller — orbits around a focus point on the ground plane.
 *
 * Features:
 *  - Pan: WASD / middle-drag / edge scroll moves the focus point
 *  - Rotate: Q/E / right-drag orbits azimuth (yaw) around focus
 *  - Zoom: scroll wheel changes distance from focus (clamped)
 *  - Camera always looks at the focus point
 *
 * Engine-level: may import settingsStore but no game stores.
 */
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import { useRtsInput } from './useRtsInput';

export interface RtsCameraConfig {
  /** Minimum zoom distance (units) */
  minZoom: number;
  /** Maximum zoom distance (units) */
  maxZoom: number;
  /** WASD/edge-scroll pan speed (units/sec) */
  panSpeed: number;
  /** Middle-drag pan speed multiplier (units/pixel) */
  dragPanSpeed: number;
  /** Q/E keyboard rotation speed (radians/sec) */
  rotateSpeed: number;
  /** Right-drag rotation speed (radians/pixel) */
  dragRotateSpeed: number;
  /** Scroll zoom speed multiplier */
  zoomSpeed: number;
  /** Enable edge scrolling */
  edgeScrollEnabled: boolean;
  /** Ground plane Y coordinate */
  groundPlaneY: number;
  /** Optional world bounds for focus point [minX, minZ, maxX, maxZ] */
  bounds?: [number, number, number, number];
  /** Initial focus point [x, z] */
  initialFocus?: [number, number];
  /** Initial azimuth angle (radians, 0 = looking from +Z toward -Z) */
  initialAzimuth?: number;
  /** Camera pitch angle (radians, 0 = horizontal, π/2 = top-down) */
  pitch?: number;
  /** Initial zoom distance (units) */
  initialZoom?: number;
}

const DEFAULT_CONFIG: RtsCameraConfig = {
  minZoom: 10,
  maxZoom: 200,
  panSpeed: 40,
  dragPanSpeed: 0.5,
  rotateSpeed: 2,
  dragRotateSpeed: 0.005,
  zoomSpeed: 0.1,
  edgeScrollEnabled: true,
  groundPlaneY: 0,
  pitch: Math.PI / 4, // 45 degrees
  initialZoom: 60,
};

// Reusable vectors — never allocate in hot path
const _forward = new Vector3();
const _right = new Vector3();
const _camPos = new Vector3();
const _focusPos = new Vector3();

export function useRtsCamera(config?: Partial<RtsCameraConfig>) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const { inputRef, consumeDeltas } = useRtsInput(cfg.edgeScrollEnabled);

  // Camera state — persisted across frames
  const focusRef = useRef({ x: cfg.initialFocus?.[0] ?? 0, z: cfg.initialFocus?.[1] ?? 0 });
  const azimuthRef = useRef(cfg.initialAzimuth ?? 0);
  const zoomRef = useRef(cfg.initialZoom ?? 60);

  useFrame(({ camera }, delta) => {
    const input = inputRef.current;
    const deltas = consumeDeltas();

    // ── Rotation ──
    // Keyboard Q/E
    if (input.rotateLeft) azimuthRef.current += cfg.rotateSpeed * delta;
    if (input.rotateRight) azimuthRef.current -= cfg.rotateSpeed * delta;
    // Right-drag
    azimuthRef.current -= deltas.rightDragDx * cfg.dragRotateSpeed;

    const azimuth = azimuthRef.current;
    const cosAz = Math.cos(azimuth);
    const sinAz = Math.sin(azimuth);

    // Forward/right directions on XZ plane (relative to camera azimuth)
    _forward.set(-sinAz, 0, -cosAz);
    _right.set(cosAz, 0, -sinAz);

    // ── Pan ──
    let panX = 0;
    let panZ = 0;

    // Keyboard
    if (input.panForward) { panX += _forward.x; panZ += _forward.z; }
    if (input.panBackward) { panX -= _forward.x; panZ -= _forward.z; }
    if (input.panRight) { panX += _right.x; panZ += _right.z; }
    if (input.panLeft) { panX -= _right.x; panZ -= _right.z; }

    // Edge scroll (same direction as keyboard)
    if (input.edgeX !== 0 || input.edgeY !== 0) {
      panX += _right.x * input.edgeX - _forward.x * input.edgeY;
      panZ += _right.z * input.edgeX - _forward.z * input.edgeY;
    }

    // Normalize diagonal keyboard/edge pan
    const panLen = Math.sqrt(panX * panX + panZ * panZ);
    if (panLen > 0) {
      const speed = cfg.panSpeed * delta / panLen;
      focusRef.current.x += panX * speed;
      focusRef.current.z += panZ * speed;
    }

    // Middle-drag pan (screen-space → world-space)
    if (deltas.middleDragDx !== 0 || deltas.middleDragDy !== 0) {
      const dragScale = cfg.dragPanSpeed * (zoomRef.current / cfg.maxZoom + 0.3);
      focusRef.current.x -= (_right.x * deltas.middleDragDx + _forward.x * deltas.middleDragDy) * dragScale;
      focusRef.current.z -= (_right.z * deltas.middleDragDx + _forward.z * deltas.middleDragDy) * dragScale;
    }

    // Clamp focus to bounds
    if (cfg.bounds) {
      focusRef.current.x = Math.max(cfg.bounds[0], Math.min(cfg.bounds[2], focusRef.current.x));
      focusRef.current.z = Math.max(cfg.bounds[1], Math.min(cfg.bounds[3], focusRef.current.z));
    }

    // ── Zoom ──
    if (deltas.scroll !== 0) {
      const zoomFactor = 1 + deltas.scroll * cfg.zoomSpeed * 0.01;
      zoomRef.current = Math.max(cfg.minZoom, Math.min(cfg.maxZoom, zoomRef.current * zoomFactor));
    }

    // ── Position camera on orbit sphere ──
    const pitch = cfg.pitch ?? Math.PI / 4;
    const cosPitch = Math.cos(pitch);
    const sinPitch = Math.sin(pitch);
    const dist = zoomRef.current;

    _camPos.set(
      focusRef.current.x + sinAz * cosPitch * dist,
      cfg.groundPlaneY + sinPitch * dist,
      focusRef.current.z + cosAz * cosPitch * dist,
    );

    _focusPos.set(focusRef.current.x, cfg.groundPlaneY, focusRef.current.z);

    camera.position.copy(_camPos);
    camera.lookAt(_focusPos);
  });

  return {
    /** Current focus point (mutable ref) */
    focusRef,
    /** Current azimuth angle (mutable ref) */
    azimuthRef,
    /** Current zoom distance (mutable ref) */
    zoomRef,
    /** Set focus point programmatically */
    setFocus: (x: number, z: number) => {
      focusRef.current.x = x;
      focusRef.current.z = z;
    },
    /** Set azimuth programmatically */
    setAzimuth: (rad: number) => {
      azimuthRef.current = rad;
    },
    /** Set zoom distance programmatically */
    setZoom: (dist: number) => {
      zoomRef.current = Math.max(cfg.minZoom, Math.min(cfg.maxZoom, dist));
    },
  };
}
