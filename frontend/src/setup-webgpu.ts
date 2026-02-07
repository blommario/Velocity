import * as THREE from 'three/webgpu';
import { extend } from '@react-three/fiber';

// Register WebGPU-aware Three.js classes with R3F's JSX catalogue.
// Must be called before any <Canvas> renders.
extend(THREE);
