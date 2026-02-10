import { useRef, useEffect, useCallback } from 'react';

export interface SpeedLinesConfig {
  minSpeed?: number;
  maxSpeed?: number;
  lineCount?: number;
  minRadius?: number;
  maxRadius?: number;
  lineLength?: number;
  maxOpacity?: number;
  color?: string;
}

export interface SpeedLinesProps {
  /** Function that returns current speed (called each frame) */
  getSpeed: () => number;
  config?: SpeedLinesConfig;
}

const DEFAULTS = {
  MIN_SPEED: 400,
  MAX_SPEED: 1000,
  LINE_COUNT: 40,
  MIN_RADIUS: 0.3,
  MAX_RADIUS: 0.95,
  LINE_LENGTH: 0.15,
  MAX_OPACITY: 0.25,
  COLOR: '255, 255, 255',
} as const;

export function SpeedLines({ getSpeed, config }: SpeedLinesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  const minSpeed = config?.minSpeed ?? DEFAULTS.MIN_SPEED;
  const maxSpeed = config?.maxSpeed ?? DEFAULTS.MAX_SPEED;
  const lineCount = config?.lineCount ?? DEFAULTS.LINE_COUNT;
  const minRadius = config?.minRadius ?? DEFAULTS.MIN_RADIUS;
  const maxRadius = config?.maxRadius ?? DEFAULTS.MAX_RADIUS;
  const lineLength = config?.lineLength ?? DEFAULTS.LINE_LENGTH;
  const maxOpacity = config?.maxOpacity ?? DEFAULTS.MAX_OPACITY;
  const colorRgb = config?.color ?? DEFAULTS.COLOR;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const speed = getSpeed();
    const intensity = Math.min(Math.max((speed - minSpeed) / (maxSpeed - minSpeed), 0), 1);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (intensity <= 0) {
      animRef.current = requestAnimationFrame(draw);
      return;
    }

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const halfDiag = Math.sqrt(cx * cx + cy * cy);

    ctx.strokeStyle = `rgba(${colorRgb}, ${intensity * maxOpacity})`;
    ctx.lineWidth = 1;
    ctx.beginPath();

    for (let i = 0; i < lineCount; i++) {
      const angle = (i / lineCount) * Math.PI * 2;
      const r0 = halfDiag * (minRadius + Math.random() * (maxRadius - minRadius));
      const r1 = r0 + halfDiag * lineLength * intensity;
      ctx.moveTo(cx + Math.cos(angle) * r0, cy + Math.sin(angle) * r0);
      ctx.lineTo(cx + Math.cos(angle) * r1, cy + Math.sin(angle) * r1);
    }

    ctx.stroke();
    animRef.current = requestAnimationFrame(draw);
  }, [getSpeed, minSpeed, maxSpeed, lineCount, minRadius, maxRadius, lineLength, maxOpacity, colorRgb]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    animRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animRef.current);
    };
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
    />
  );
}
