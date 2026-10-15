import { flyTo } from "../motion/flight";

const FLIGHT_MS = 480;

/**
 * Sends a word from one element to another as a small chip, so the player sees where a
 * word went. The chip is removed when the flight ends. Callers skip this under reduced motion.
 */
export function flyWord(word: string, from: Element, to: Element): void {
  const origin = from.getBoundingClientRect();
  const chip = document.createElement("div");
  chip.className = "fly-chip";
  chip.textContent = word.toUpperCase();
  chip.style.left = `${origin.left + origin.width / 2}px`;
  chip.style.top = `${origin.top + origin.height / 2}px`;
  document.body.append(chip);
  flyTo(chip, chip.getBoundingClientRect(), to.getBoundingClientRect(), { duration: FLIGHT_MS });
  window.setTimeout(() => chip.remove(), FLIGHT_MS + 40);
}
