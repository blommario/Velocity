import { useEffect, useState, useRef } from 'react';

export interface ScreenTransitionProps {
  /** Key that changes on screen switch (triggers transition) */
  screenKey: string;
  /** Transition duration in ms (default: 300) */
  duration?: number;
  children: React.ReactNode;
}

export function ScreenTransition({ screenKey, duration = 300, children }: ScreenTransitionProps) {
  const [transitioning, setTransitioning] = useState(false);
  const [visible, setVisible] = useState(true);
  const prevKeyRef = useRef(screenKey);

  useEffect(() => {
    if (screenKey !== prevKeyRef.current) {
      prevKeyRef.current = screenKey;
      setTransitioning(true);
      setVisible(false);

      const timer = setTimeout(() => {
        setVisible(true);
        const endTimer = setTimeout(() => setTransitioning(false), duration);
        return () => clearTimeout(endTimer);
      }, 50);

      return () => clearTimeout(timer);
    }
  }, [screenKey, duration]);

  return (
    <div
      className="absolute inset-0"
      style={{
        opacity: visible ? 1 : 0,
        transition: transitioning ? `opacity ${duration}ms ease-out` : 'none',
      }}
    >
      {children}
    </div>
  );
}
