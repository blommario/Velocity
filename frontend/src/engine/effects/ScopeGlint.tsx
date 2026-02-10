/**
 * ScopeGlint — emissive lens-flare sprite for scoped weapons.
 *
 * Generic engine component. Place in the main scene. Provide `isActive`
 * and position/direction props each frame via the `onUpdate` callback.
 * Uses SpriteNodeMaterial with high emissive (×6.0) to trigger bloom.
 * Single sprite, additive blending, no depth write.
 */
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { float, vec4 } from 'three/tsl';
import {
  AdditiveBlending, SpriteNodeMaterial,
  Sprite,
} from 'three/webgpu';
export interface ScopeGlintConfig {
  /** Emissive multiplier (default 6.0, exceeds bloom threshold) */
  emissiveMult?: number;
  /** Sprite base size (default 0.15) */
  size?: number;
  /** Offset from eye along view direction (default 1.2) */
  forwardOffset?: number;
  /** RGB color 0-1 (default [0.6, 0.5, 1.0]) */
  color?: readonly [number, number, number];
  /** Flicker oscillation speed (default 8) */
  flickerSpeed?: number;
  /** Flicker intensity 0-1 (default 0.3) */
  flickerAmount?: number;
}

export interface ScopeGlintProps {
  /** Called each frame; return null to hide, or position + forward to show. */
  getState: () => ScopeGlintState | null;
  config?: ScopeGlintConfig;
}

export interface ScopeGlintState {
  position: readonly [number, number, number];
  forward: readonly [number, number, number];
  intensity: number;  // 0-1, typically adsProgress
}

const DEFAULTS: Required<ScopeGlintConfig> = {
  emissiveMult: 6.0,
  size: 0.15,
  forwardOffset: 1.2,
  color: [0.6, 0.5, 1.0],
  flickerSpeed: 8,
  flickerAmount: 0.3,
} as const;

export function ScopeGlint({ getState, config }: ScopeGlintProps) {
  const spriteRef = useRef<InstanceType<typeof Sprite>>(null);

  // Stable config — only recompute when config reference changes
  const cfg = useMemo(() => ({ ...DEFAULTS, ...config }), [config]);

  const material = useMemo(() => {
    const mat = new SpriteNodeMaterial();
    mat.transparent = true;
    mat.blending = AdditiveBlending;
    mat.depthWrite = false;
    const [r, g, b] = cfg.color;
    const e = cfg.emissiveMult;
    mat.colorNode = vec4(float(r * e), float(g * e), float(b * e), float(0.8));
    return mat;
  }, [cfg.color, cfg.emissiveMult]);

  useFrame(() => {
    const sprite = spriteRef.current;
    if (!sprite) return;

    const state = getState();
    if (!state) {
      sprite.visible = false;
      return;
    }

    sprite.visible = true;

    const { position, forward, intensity } = state;
    sprite.position.set(
      position[0] + forward[0] * cfg.forwardOffset,
      position[1] + forward[1] * cfg.forwardOffset,
      position[2] + forward[2] * cfg.forwardOffset,
    );

    const flicker = 1 - cfg.flickerAmount * 0.5 *
      (1 + Math.sin(performance.now() * 0.001 * cfg.flickerSpeed));
    sprite.scale.setScalar(cfg.size * flicker * intensity);
  });

  return <sprite ref={spriteRef} material={material} />;
}
