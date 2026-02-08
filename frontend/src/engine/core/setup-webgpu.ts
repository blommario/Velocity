import * as THREE from 'three/webgpu';
import { extend } from '@react-three/fiber';
import RAPIER from '@dimforge/rapier3d-compat';

// Register WebGPU-aware Three.js classes with R3F's JSX catalogue.
// Must be called before any <Canvas> renders.
extend(THREE);

// Pre-initialize Rapier WASM so subsequent init() from @react-three/rapier is a no-op.
// KNOWN ISSUE: rapier3d-compat's own init() uses deprecated positional WASM params internally.
// This warning cannot be fixed without a rapier package update.
RAPIER.init({});
