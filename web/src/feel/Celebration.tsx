import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import { useGameSounds } from "@freegamestore/games";
import { prefersReducedMotion } from "../motion/reducedMotion";

const PIECE_COUNT = 36;
const RUN_MS = 2000;

interface CelebrationProps {
  /** Identifies this burst; passed back to `onDone` when it finishes. */
  id: string;
  label?: string;
  onDone: (id: string) => void;
}

/**
 * Confetti burst and banner for five of a kind. Pieces are placed by a fixed
 * formula rather than randomly, so a burst looks the same each time it plays.
 * With reduced motion it shows only the banner. Sound follows the platform mute.
 */
export function Celebration({ id, label = "Five of a kind!", onDone }: CelebrationProps) {
  const { playLevelUp } = useGameSounds();
  const played = useRef(false);
  const reduced = prefersReducedMotion();

  const pieces = useMemo(
    () =>
      Array.from({ length: PIECE_COUNT }, (_, i) => ({
        left: `${(i * 37) % 100}%`,
        delay: `${(i % 9) * 70}ms`,
        duration: `${1300 + (i % 5) * 200}ms`,
        dx: `${((i * 53) % 160) - 80}px`,
        rot: `${(i * 97) % 720}deg`,
      })),
    [],
  );

  // Play once per burst, even if the mute setting changes while it runs.
  useEffect(() => {
    if (played.current) return;
    played.current = true;
    playLevelUp();
  }, [playLevelUp]);

  useEffect(() => {
    const timer = window.setTimeout(() => onDone(id), RUN_MS);
    return () => window.clearTimeout(timer);
  }, [id, onDone]);

  return (
    <div className="celebration" role="status" aria-live="polite">
      {!reduced &&
        pieces.map((p, i) => (
          <span
            key={i}
            className="confetti-piece"
            style={
              {
                left: p.left,
                animationDelay: p.delay,
                animationDuration: p.duration,
                "--dx": p.dx,
                "--rot": p.rot,
              } as CSSProperties
            }
          />
        ))}
      <p className="celebrate-banner">{label}</p>
    </div>
  );
}
