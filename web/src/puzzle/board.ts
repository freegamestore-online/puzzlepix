import { createRng, hashInts } from "../art/rng";
import type { Puzzle } from "./cut";

/** Quarter turns: 0, 90, 180 or 270 degrees clockwise. */
export type Rotation = 0 | 1 | 2 | 3;

/** Where one piece is on the table, in table pixels: the top-left of its cell, plus its turn. */
export interface Placement {
  x: number;
  y: number;
  rotation: Rotation;
}

/** Placements indexed by piece id. */
export type Placements = readonly Placement[];

export type TrayMode = "scatter" | "edges";

/** Two placements count as exactly related within this many pixels. */
export const EPS = 0.5;

/** Gap between the board and the tray, in table pixels. */
export const TRAY_GAP = 24;

/** How close a piece must be to a snap target before it jumps there. */
export function snapThreshold(puzzle: Puzzle): number {
  return 0.25 * Math.min(puzzle.cellW, puzzle.cellH);
}

/** The table is the board, then the tray below it. */
export function stageSize(puzzle: Puzzle): { width: number; height: number } {
  return { width: puzzle.width, height: puzzle.height * 2 + TRAY_GAP };
}

/** The neighbours of a piece, to its left, right, above and below, where they exist. */
export function neighbours(puzzle: Puzzle, id: number): number[] {
  const { col, row } = puzzle.pieces[id]!;
  const out: number[] = [];
  if (col > 0) out.push(id - 1);
  if (col < puzzle.cols - 1) out.push(id + 1);
  if (row > 0) out.push(id - puzzle.cols);
  if (row < puzzle.rows - 1) out.push(id + puzzle.cols);
  return out;
}

/**
 * Two neighbours are joined when both are upright and sit exactly where the cut puts them
 * relative to each other. Joined pieces move together.
 */
export function joined(puzzle: Puzzle, placements: Placements, a: number, b: number): boolean {
  const pa = placements[a]!;
  const pb = placements[b]!;
  if (pa.rotation !== 0 || pb.rotation !== 0) return false;
  const pieceA = puzzle.pieces[a]!;
  const pieceB = puzzle.pieces[b]!;
  return (
    Math.abs(pa.x - pb.x - (pieceA.x - pieceB.x)) <= EPS &&
    Math.abs(pa.y - pb.y - (pieceA.y - pieceB.y)) <= EPS
  );
}

/** The ids of the group that `id` belongs to, found by joining exact neighbours. Sorted. */
export function groupOf(puzzle: Puzzle, placements: Placements, id: number): number[] {
  const seen = new Set<number>([id]);
  const queue = [id];
  while (queue.length > 0) {
    const current = queue.pop()!;
    for (const next of neighbours(puzzle, current)) {
      if (!seen.has(next) && joined(puzzle, placements, current, next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return [...seen].sort((a, b) => a - b);
}

/** Move a set of pieces by the same offset. */
function shift(placements: Placements, ids: readonly number[], dx: number, dy: number): Placement[] {
  const next = placements.slice();
  for (const id of ids) {
    const p = next[id]!;
    next[id] = { ...p, x: p.x + dx, y: p.y + dy };
  }
  return next;
}

/**
 * Snap the group that `id` belongs to, if one of its pieces is within `threshold` of a target:
 * its correct place on the board, or the place its cut puts it beside a piece that is not in
 * the group. The nearest target wins, and the whole group moves by the same amount. Upright
 * pieces only.
 */
export function snapGroup(
  puzzle: Puzzle,
  placements: Placements,
  id: number,
  threshold: number,
): { placements: Placement[]; snapped: boolean } {
  const group = groupOf(puzzle, placements, id);
  let best: { id: number; dx: number; dy: number; distance: number } | null = null;

  for (const member of group) {
    const p = placements[member]!;
    if (p.rotation !== 0) continue;
    const piece = puzzle.pieces[member]!;
    const targets: { x: number; y: number }[] = [{ x: piece.x, y: piece.y }];
    for (const other of neighbours(puzzle, member)) {
      if (group.includes(other)) continue;
      const q = placements[other]!;
      const o = puzzle.pieces[other]!;
      targets.push({ x: q.x + (piece.x - o.x), y: q.y + (piece.y - o.y) });
    }
    for (const t of targets) {
      const dx = t.x - p.x;
      const dy = t.y - p.y;
      const distance = Math.hypot(dx, dy);
      if (distance <= threshold && (best === null || distance < best.distance)) {
        best = { id: member, dx, dy, distance };
      }
    }
  }

  if (best === null) return { placements: placements.slice(), snapped: false };
  return { placements: shift(placements, group, best.dx, best.dy), snapped: true };
}

/**
 * A drop: the group that `id` belongs to moves by (dx, dy), then snaps if it is close enough.
 * Returns the new placements and whether a snap happened.
 */
export function drop(
  puzzle: Puzzle,
  placements: Placements,
  id: number,
  dx: number,
  dy: number,
  threshold = snapThreshold(puzzle),
): { placements: Placement[]; snapped: boolean } {
  const moved = shift(placements, groupOf(puzzle, placements, id), dx, dy);
  return snapGroup(puzzle, moved, id, threshold);
}

/** Turn a piece a quarter turn. Only a piece on its own can turn, so groups stay upright. */
export function rotatePiece(puzzle: Puzzle, placements: Placements, id: number): Placement[] {
  if (groupOf(puzzle, placements, id).length > 1) return placements.slice();
  const next = placements.slice();
  const p = next[id]!;
  next[id] = { ...p, rotation: ((p.rotation + 1) % 4) as Rotation };
  return next;
}

/** True when every piece is upright and in its correct place on the board. */
export function isSolved(puzzle: Puzzle, placements: Placements): boolean {
  return puzzle.pieces.every((piece) => {
    const p = placements[piece.id]!;
    return p.rotation === 0 && Math.abs(p.x - piece.x) <= EPS && Math.abs(p.y - piece.y) <= EPS;
  });
}

export function isBorder(puzzle: Puzzle, id: number): boolean {
  const { col, row } = puzzle.pieces[id]!;
  return col === 0 || row === 0 || col === puzzle.cols - 1 || row === puzzle.rows - 1;
}

/**
 * Where the pieces start, in the tray below the board. `scatter` throws them down at random;
 * `edges` lays them out in rows with the edge pieces first. Pieces turn at random when
 * `rotations` is on.
 */
export function layoutTray(puzzle: Puzzle, mode: TrayMode, seed: number, rotations: boolean): Placement[] {
  const rng = createRng(hashInts(seed >>> 0, 77));
  const trayY = puzzle.height + TRAY_GAP;
  const trayH = puzzle.height;
  const turn = (): Rotation => (rotations ? (Math.floor(rng() * 4) as Rotation) : 0);

  if (mode === "scatter") {
    return puzzle.pieces.map(() => ({
      x: rng() * (puzzle.width - puzzle.cellW),
      y: trayY + rng() * (trayH - puzzle.cellH),
      rotation: turn(),
    }));
  }

  // Edge pieces first, then the rest, each group in piece order.
  const order = [...puzzle.pieces].sort((a, b) => {
    const edgeA = isBorder(puzzle, a.id) ? 0 : 1;
    const edgeB = isBorder(puzzle, b.id) ? 0 : 1;
    return edgeA - edgeB || a.id - b.id;
  });
  const perRow = Math.max(1, Math.floor(puzzle.width / puzzle.cellW));
  const placements: Placement[] = new Array(puzzle.pieces.length);
  order.forEach((piece, slot) => {
    placements[piece.id] = {
      x: (slot % perRow) * puzzle.cellW,
      y: trayY + Math.floor(slot / perRow) * puzzle.cellH,
      rotation: turn(),
    };
  });
  return placements;
}
