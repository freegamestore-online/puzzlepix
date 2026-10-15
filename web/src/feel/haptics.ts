// TODO: switch to @freegamestore/games/feel once published
/**
 * Haptic pulses through the Vibration API. Pure except for the one `vibrate`
 * call, so the patterns can be checked in tests and moved into the SDK feel kit (#207).
 */

/** Milliseconds to vibrate, or alternating vibrate and pause durations. */
export type VibrationPattern = number | readonly number[];

/** Named pulses for the game's key events. Each stays short so it reads as feedback, not buzzing. */
export const HAPTICS = {
  /** A match clears: a crisp double tick. */
  clear: [12, 40, 18],
  /** The tray fills and the game ends: a heavier, slower pulse. */
  gameOver: [60, 80, 120],
} as const satisfies Record<string, VibrationPattern>;

/**
 * Ask the device to vibrate. Returns false when the Vibration API is missing, which
 * covers desktop browsers and iOS Safari. Nothing else happens in that case.
 */
export function vibrate(pattern: VibrationPattern, nav: Pick<Navigator, "vibrate"> | undefined = globalNavigator()): boolean {
  if (typeof nav?.vibrate !== "function") return false;
  return nav.vibrate(pattern as number | number[]);
}

function globalNavigator(): Pick<Navigator, "vibrate"> | undefined {
  return typeof navigator === "undefined" ? undefined : navigator;
}
