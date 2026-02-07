import { useEffect, useState, useRef } from 'react';
import { useGameStore, type Screen } from '../../stores/gameStore';

const TRANSITION = {
  DURATION: 300,
} as const;

/**
 * Animated slide/fade transition when switching screens.
 * Wraps the HUD layer and applies a brief fade effect on screen changes.
 */
export function ScreenTransition({ children }: { children: React.ReactNode }) {
  const screen = useGameStore((s) => s.screen);
  const [transitioning, setTransitioning] = useState(false);
  const [visible, setVisible] = useState(true);
  const prevScreenRef = useRef<Screen>(screen);

  useEffect(() => {
    if (screen !== prevScreenRef.current) {
      prevScreenRef.current = screen;
      setTransitioning(true);
      setVisible(false);

      // Fade in after a short delay
      const timer = setTimeout(() => {
        setVisible(true);
        const endTimer = setTimeout(() => setTransitioning(false), TRANSITION.DURATION);
        return () => clearTimeout(endTimer);
      }, 50);

      return () => clearTimeout(timer);
    }
  }, [screen]);

  return (
    <div
      className="absolute inset-0"
      style={{
        opacity: visible ? 1 : 0,
        transition: transitioning ? `opacity ${TRANSITION.DURATION}ms ease-out` : 'none',
      }}
    >
      {children}
    </div>
  );
}
