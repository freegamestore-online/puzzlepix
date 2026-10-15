// TODO: switch to @freegamestore/games/feel once published
import { useEffect, useRef } from "react";
import { easeInQuad, easeOutQuad } from "../motion/easing";
import { prefersReducedMotion } from "../motion/reducedMotion";
import { tweenProgress, tweenValue } from "../motion/tween";

/** How long a pop-up stays on screen, in ms. */
export const SCORE_POP_MS = 700;

/** How far a pop-up rises before it fades, in px. */
const RISE_PX = 40;

export interface ScorePopProps {
  /** The points to show, as `+N`. */
  points: number;
  /** Centre of the pop-up, in the pixel space of its positioned ancestor. */
  x: number;
  y: number;
  /** Called once the pop-up has finished. The parent should remove it. */
  onDone: () => void;
}

/**
 * A floating `+N` that rises and fades from (x, y), then calls `onDone`.
 * Under reduced motion it holds still for the same time, so the number is still
 * seen and `onDone` still fires. Pass nothing else: the component draws only itself.
 */
export function ScorePop({ points, x, y, onDone }: ScorePopProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (prefersReducedMotion()) {
      const id = setTimeout(() => onDoneRef.current(), SCORE_POP_MS);
      return () => clearTimeout(id);
    }

    let started: number | null = null;
    let frame = 0;
    const step = (now: number) => {
      started ??= now;
      const elapsed = now - started;
      const rise = tweenValue(0, -RISE_PX, elapsed, SCORE_POP_MS, easeOutQuad);
      element.style.transform = `translate(-50%, calc(-50% + ${rise}px))`;
      element.style.opacity = String(tweenValue(1, 0, elapsed, SCORE_POP_MS, easeInQuad));
      if (tweenProgress(elapsed, SCORE_POP_MS) < 1) {
        frame = requestAnimationFrame(step);
      } else {
        onDoneRef.current();
      }
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <span
      ref={ref}
      className="score-pop"
      style={{ left: x, top: y, transform: "translate(-50%, -50%)" }}
    >
      {`+${points}`}
    </span>
  );
}
