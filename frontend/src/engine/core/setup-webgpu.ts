import * as THREE from 'three/webgpu';
import { extend } from '@react-three/fiber';
import RAPIER from '@dimforge/rapier3d-compat';

// Register WebGPU-aware Three.js classes with R3F's JSX catalogue.
// Must be called before any <Canvas> renders.
extend(THREE);

// Pre-initialize Rapier WASM so subsequent init() from @react-three/rapier is a no-op.
// Top-level await is safe here: target=esnext + Vite handles it correctly.
// NOTE: rapier3d-compat 0.19 internally passes WASM bytes as a positional param to
// wasm-bindgen's init, which logs a deprecation warning. This is upstream — not fixable here.
await RAPIER.init();
