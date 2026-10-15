import { EPS, groupOf, isBorder, isSolved, type Placement, type Placements } from "./board";
import type { Puzzle } from "./cut";

/** The ids of the pieces on the outside of the picture. */
export function edgeIds(puzzle: Puzzle): number[] {
  return puzzle.pieces.filter((piece) => isBorder(puzzle, piece.id)).map((piece) => piece.id);
}

/** True when a piece is upright and in its correct place. */
function isPlaced(puzzle: Puzzle, placements: Placements, id: number): boolean {
  const p = placements[id]!;
  const piece = puzzle.pieces[id]!;
  return p.rotation === 0 && Math.abs(p.x - piece.x) <= EPS && Math.abs(p.y - piece.y) <= EPS;
}

/**
 * The one-piece hint: put one piece that is not yet in its correct place onto its spot. A piece
 * on its own is preferred, so no group is split. Returns null when the puzzle is already solved.
 */
export function hintPlacements(puzzle: Puzzle, placements: Placements): Placement[] | null {
  if (isSolved(puzzle, placements)) return null;
  const misplaced = puzzle.pieces.map((piece) => piece.id).filter((id) => !isPlaced(puzzle, placements, id));
  const id = misplaced.find((candidate) => groupOf(puzzle, placements, candidate).length === 1) ?? misplaced[0];
  if (id === undefined) return null;
  const piece = puzzle.pieces[id]!;
  const next = placements.slice();
  next[id] = { x: piece.x, y: piece.y, rotation: 0 };
  return next;
}
