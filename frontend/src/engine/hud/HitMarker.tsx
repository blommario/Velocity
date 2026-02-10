/**
 * Generic hit marker HUD — renders a brief crosshair burst on hit with support for kill and headshot variants.
 * Headshot renders a red X shape; normal/kill renders diagonal corner lines.
 * Uses direct DOM manipulation for opacity/transform to avoid React re-renders during animation.
 * Depends on: nothing (standalone engine component)
 * Used by: game HitMarker wrapper (HudOverlay)
 */
import { useEffect, useRef, useCallback } from 'react';

export interface HitMarkerConfig {
  duration?: number;
  size?: number;
  thickness?: number;
  gap?: number;
  color?: string;
  killColor?: string;
  headshotColor?: string;
}

interface HitMark {
  id: number;
  timestamp: number;
  isKill: boolean;
  isHeadshot: boolean;
}

const DEFAULTS = {
  DURATION: 0.3,
  SIZE: 16,
  THICKNESS: 2,
  GAP: 6,
} as const;

// Imperative API — module-level queue
let _nextId = 0;
const _pendingHits: HitMark[] = [];

/** Push a hit marker from outside React (e.g. physics tick). */
export function pushHitMarker(isKill = false, isHeadshot = false): void {
  _pendingHits.push({ id: _nextId++, timestamp: Date.now(), isKill, isHeadshot });
}

export interface HitMarkerProps {
  config?: HitMarkerConfig;
  /** Called on each hit (for audio, etc.) */
  onHit?: (isKill: boolean, isHeadshot: boolean) => void;
}

export function HitMarker({ config, onHit }: HitMarkerProps) {
  const dur = config?.duration ?? DEFAULTS.DURATION;
  const size = config?.size ?? DEFAULTS.SIZE;
  const thickness = config?.thickness ?? DEFAULTS.THICKNESS;
  const gap = config?.gap ?? DEFAULTS.GAP;
  const normalColor = config?.color ?? '#ffffff';
  const killColor = config?.killColor ?? '#ff4444';
  const headshotColor = config?.headshotColor ?? '#ff2222';

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Track active marks via ref — no React state
  const marksRef = useRef<HitMark[]>([]);
  // Track current shape type to know when SVG structure needs rebuild
  const shapeRef = useRef<'none' | 'headshot' | 'normal'>('none');
  // Stable ref for onHit callback
  const onHitRef = useRef(onHit);
  onHitRef.current = onHit;

  // Build SVG child elements imperatively
  const buildShape = useCallback((type: 'headshot' | 'normal', color: string) => {
    const svg = svgRef.current;
    if (!svg) return;
    // Clear existing children
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    const cx = size * 2;
    const cy = size * 2;
    const ns = 'http://www.w3.org/2000/svg';

    if (type === 'headshot') {
      // X shape — two crossing lines
      const line1 = document.createElementNS(ns, 'line');
      line1.setAttribute('x1', String(cx - size));
      line1.setAttribute('y1', String(cy - size));
      line1.setAttribute('x2', String(cx + size));
      line1.setAttribute('y2', String(cy + size));
      line1.setAttribute('stroke', color);
      line1.setAttribute('stroke-width', String(thickness + 1));
      line1.setAttribute('stroke-linecap', 'round');
      svg.appendChild(line1);

      const line2 = document.createElementNS(ns, 'line');
      line2.setAttribute('x1', String(cx + size));
      line2.setAttribute('y1', String(cy - size));
      line2.setAttribute('x2', String(cx - size));
      line2.setAttribute('y2', String(cy + size));
      line2.setAttribute('stroke', color);
      line2.setAttribute('stroke-width', String(thickness + 1));
      line2.setAttribute('stroke-linecap', 'round');
      svg.appendChild(line2);
    } else {
      // 4 diagonal corner lines
      const dirs = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      for (const [dx, dy] of dirs) {
        const line = document.createElementNS(ns, 'line');
        line.setAttribute('x1', String(cx + dx * gap));
        line.setAttribute('y1', String(cy + dy * gap));
        line.setAttribute('x2', String(cx + dx * size));
        line.setAttribute('y2', String(cy + dy * size));
        line.setAttribute('stroke', color);
        line.setAttribute('stroke-width', String(thickness));
        line.setAttribute('stroke-linecap', 'round');
        svg.appendChild(line);
      }
    }
  }, [size, thickness, gap]);

  // Update stroke color on all SVG lines
  const updateColor = useCallback((color: string) => {
    const svg = svgRef.current;
    if (!svg) return;
    const lines = svg.querySelectorAll('line');
    for (let i = 0; i < lines.length; i++) {
      lines[i].setAttribute('stroke', color);
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const svg = svgRef.current;
    if (!container || !svg) return;

    // Start hidden
    container.style.display = 'none';

    let raf = 0;
    const tick = () => {
      const now = Date.now();
      const marks = marksRef.current;

      // Drain pending hits
      if (_pendingHits.length > 0) {
        for (const hit of _pendingHits) {
          onHitRef.current?.(hit.isKill, hit.isHeadshot);
        }
        marks.push(..._pendingHits.splice(0));
      }

      // Expire old marks
      const cutoff = now - dur * 1000;
      while (marks.length > 0 && marks[0].timestamp <= cutoff) {
        marks.shift();
      }

      if (marks.length === 0) {
        if (shapeRef.current !== 'none') {
          container.style.display = 'none';
          shapeRef.current = 'none';
        }
        raf = requestAnimationFrame(tick);
        return;
      }

      // Show container
      container.style.display = '';

      const latest = marks[marks.length - 1];
      const age = (now - latest.timestamp) / 1000;
      const progress = Math.min(age / dur, 1);
      const opacity = 1 - progress;
      const scale = latest.isHeadshot ? 1 + progress * 0.5 : 1 + progress * 0.3;
      const color = latest.isKill ? killColor : latest.isHeadshot ? headshotColor : normalColor;
      const newShape = latest.isHeadshot ? 'headshot' : 'normal';

      // Rebuild SVG structure only when shape type changes
      if (shapeRef.current !== newShape) {
        buildShape(newShape as 'headshot' | 'normal', color);
        shapeRef.current = newShape;
      } else {
        updateColor(color);
      }

      svg.style.opacity = String(opacity);
      svg.style.transform = `scale(${scale})`;

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [dur, normalColor, killColor, headshotColor, buildShape, updateColor]);

  const svgSize = size * 4;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none flex items-center justify-center"
    >
      <svg
        ref={svgRef}
        width={svgSize}
        height={svgSize}
        viewBox={`0 0 ${svgSize} ${svgSize}`}
        style={{ transition: 'none' }}
      />
    </div>
  );
}
