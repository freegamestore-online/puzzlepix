// TODO: switch to @freegamestore/games/feel once published
import { easeOutQuad, type Easing } from "./easing";
import { tweenValue } from "./tween";

/** A rectangle in one shared coordinate space. */
export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface FlightOptions {
  /** Length of the flight, in ms. */
  duration: number;
  easing?: Easing;
}

/**
 * Move `el` from where it was (`from`) to where it sits now (`to`), by tweening
 * its transform down to nothing. Returns a cancel function. The inline transform
 * and opacity are cleared when the flight ends or is cancelled. Callers decide
 * whether to fly at all, and skip it under reduced motion.
 */
export function flyTo(el: HTMLElement, from: Box, to: Box, { duration, easing = easeOutQuad }: FlightOptions): () => void {
  const dx = from.left + from.width / 2 - (to.left + to.width / 2);
  const dy = from.top + from.height / 2 - (to.top + to.height / 2);
  const scale = to.width > 0 ? from.width / to.width : 1;
  let started: number | null = null;
  let frame = 0;

  const clear = () => {
    el.style.transform = "";
    el.style.opacity = "";
  };

  const step = (now: number) => {
    started ??= now;
    const elapsed = now - started;
    const x = tweenValue(dx, 0, elapsed, duration, easing);
    const y = tweenValue(dy, 0, elapsed, duration, easing);
    const s = tweenValue(scale, 1, elapsed, duration, easing);
    el.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
    el.style.opacity = String(tweenValue(0.6, 1, elapsed, duration, easing));
    if (elapsed < duration) {
      frame = requestAnimationFrame(step);
    } else {
      clear();
    }
  };

  frame = requestAnimationFrame(step);
  return () => {
    cancelAnimationFrame(frame);
    clear();
  };
}
