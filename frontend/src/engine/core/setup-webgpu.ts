import * as THREE from 'three/webgpu';
import { extend } from '@react-three/fiber';
import RAPIER from '@dimforge/rapier3d-compat';

// Register WebGPU-aware Three.js classes with R3F's JSX catalogue.
// Must be called before any <Canvas> renders.
extend(THREE);

// Pre-initialize Rapier WASM with correct object syntax.
// @react-three/rapier calls init() with deprecated positional params — by
// initializing first, its subsequent init() becomes a no-op (wasm cached).
RAPIER.init({});
