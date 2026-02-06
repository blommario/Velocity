import { useRef, useEffect, useCallback } from 'react';
import { useGameStore } from '../../stores/gameStore';

const SPEED_LINES = {
  MIN_SPEED: 400,
  MAX_SPEED: 1000,
  LINE_COUNT: 40,
  MIN_RADIUS: 0.3,   // fraction of half-diagonal
  MAX_RADIUS: 0.95,
  LINE_LENGTH: 0.15,  // fraction of half-diagonal
  MAX_OPACITY: 0.25,
} as const;

export function SpeedLines() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const speedRef = useRef(0);

  // Subscribe to speed outside render to avoid re-renders
  useEffect(() => {
    const unsub = useGameStore.subscribe(
      (state) => { speedRef.current = state.speed; },
    );
    return unsub;
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const speed = speedRef.current;
    const intensity = Math.min(
      Math.max((speed - SPEED_LINES.MIN_SPEED) / (SPEED_LINES.MAX_SPEED - SPEED_LINES.MIN_SPEED), 0),
      1,
    );

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (intensity <= 0) {
      animRef.current = requestAnimationFrame(draw);
      return;
    }

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const halfDiag = Math.sqrt(cx * cx + cy * cy);

    ctx.strokeStyle = `rgba(255, 255, 255, ${intensity * SPEED_LINES.MAX_OPACITY})`;
    ctx.lineWidth = 1;
    ctx.beginPath();

    for (let i = 0; i < SPEED_LINES.LINE_COUNT; i++) {
      const angle = (i / SPEED_LINES.LINE_COUNT) * Math.PI * 2;
      const r0 = halfDiag * (SPEED_LINES.MIN_RADIUS + Math.random() * (SPEED_LINES.MAX_RADIUS - SPEED_LINES.MIN_RADIUS));
      const r1 = r0 + halfDiag * SPEED_LINES.LINE_LENGTH * intensity;
      ctx.moveTo(cx + Math.cos(angle) * r0, cy + Math.sin(angle) * r0);
      ctx.lineTo(cx + Math.cos(angle) * r1, cy + Math.sin(angle) * r1);
    }

    ctx.stroke();
    animRef.current = requestAnimationFrame(draw);
  }, []);

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
