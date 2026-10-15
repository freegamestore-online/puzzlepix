export interface CompletionEffects {
  /** The clean picture is shown over the pieces. */
  picture: boolean;
  /** The picture fades in. */
  fadeIn: boolean;
  /** A sheen crosses the board. */
  shimmer: boolean;
}

/**
 * What a board shows once it is solved. Reduced motion keeps the finished picture but drops the
 * fade and the sheen. Before the solve, nothing is shown.
 */
export function completionEffects(solved: boolean, reducedMotion: boolean): CompletionEffects {
  if (!solved) return { picture: false, fadeIn: false, shimmer: false };
  return { picture: true, fadeIn: !reducedMotion, shimmer: !reducedMotion };
}
