import { useMemo } from "react";

interface FireBackgroundProps {
  emberCount?: number;
}

/**
 * Gamer-style ambient fire background.
 * Renders a fixed full-screen layer with two glowing fire orbs and
 * a configurable number of rising ember particles. Pointer-events: none.
 */
export function FireBackground({ emberCount = 24 }: FireBackgroundProps) {
  const embers = useMemo(
    () =>
      Array.from({ length: emberCount }).map((_, i) => {
        const left = Math.random() * 100;
        const duration = 6 + Math.random() * 10;
        const delay = Math.random() * 8;
        const size = 2 + Math.random() * 4;
        const hue = 10 + Math.random() * 30; // 10-40 (red→orange→amber)
        return { id: i, left, duration, delay, size, hue };
      }),
    [emberCount]
  );

  return (
    <div className="fire-bg-overlay" aria-hidden="true">
      {embers.map((e) => (
        <span
          key={e.id}
          className="ember"
          style={{
            left: `${e.left}%`,
            width: `${e.size}px`,
            height: `${e.size}px`,
            background: `hsl(${e.hue} 90% 55%)`,
            boxShadow: `0 0 8px hsl(${e.hue} 90% 55%), 0 0 16px hsl(${e.hue} 85% 45%)`,
            animationDuration: `${e.duration}s`,
            animationDelay: `${e.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
