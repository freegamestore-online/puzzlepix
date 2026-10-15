import { createRng, hashInts } from "../art/rng";

/** The piece counts a puzzle can be cut into. */
export const PIECE_COUNTS = [12, 24, 48, 96, 150] as const;
export type PieceCount = (typeof PIECE_COUNTS)[number];

/**
 * How a side is cut. `out` is +1 when the side bulges outward (a tab), -1 when it dents inward
 * (a blank), and 0 on the edge of the picture. A side and its neighbour's matching side share
 * `seed`, so the tab fits its blank exactly.
 */
export interface Side {
  out: -1 | 0 | 1;
  seed: number;
}

export interface Piece {
  /** row * cols + col. Also the index into `Puzzle.pieces`. */
  id: number;
  col: number;
  row: number;
  /** Where the piece's cell sits on the finished board, in board pixels. */
  x: number;
  y: number;
  top: Side;
  right: Side;
  bottom: Side;
  left: Side;
}

export interface Puzzle {
  count: PieceCount;
  cols: number;
  rows: number;
  cellW: number;
  cellH: number;
  width: number;
  height: number;
  pieces: Piece[];
}

/** One drawing step in piece-local pixels. `pts` holds x, y pairs: one for M and L, three for C. */
export interface Step {
  op: "M" | "L" | "C";
  pts: readonly number[];
}

/**
 * The grid for `count` pieces on a picture of the given shape. Among the factor pairs, pick the
 * one closest to the picture's aspect ratio. Rows and columns are at least 2 and at most 3:1 apart.
 */
export function gridFor(count: number, width: number, height: number): { cols: number; rows: number } {
  const aspect = width / height;
  let best: { cols: number; rows: number } | null = null;
  let bestScore = Infinity;
  for (let cols = 2; cols <= count / 2; cols++) {
    if (count % cols !== 0) continue;
    const rows = count / cols;
    if (rows < 2 || Math.max(cols, rows) / Math.min(cols, rows) > 3) continue;
    const score = Math.abs(Math.log(cols / rows / aspect));
    if (score < bestScore) {
      bestScore = score;
      best = { cols, rows };
    }
  }
  return best ?? { cols: count, rows: 1 };
}

/** Sign (±1) and shape seed of the cut between two neighbours. kind 0 is horizontal, 1 vertical. */
function edge(seed: number, kind: number, i: number, j: number): { sign: 1 | -1; seed: number } {
  return {
    sign: hashInts(seed, 1, kind, i, j) & 1 ? 1 : -1,
    seed: hashInts(seed, 2, kind, i, j),
  };
}

/**
 * Cut a `width` × `height` picture into `count` interlocking pieces. The same seed always gives
 * the same cut. Each internal edge is decided once, so the two pieces on either side agree.
 */
export function cutPuzzle(seed: number, count: PieceCount, width: number, height: number): Puzzle {
  const { cols, rows } = gridFor(count, width, height);
  const cellW = width / cols;
  const cellH = height / rows;
  const s = seed >>> 0;

  // The cut between row r-1 and row r, in column c. Pieces on the picture's edge get out = 0.
  const horizontal = (r: number, c: number): Side => {
    if (r <= 0 || r >= rows) return { out: 0, seed: 0 };
    const e = edge(s, 0, r, c);
    return { out: e.sign, seed: e.seed };
  };
  // The cut between column c-1 and column c, in row r.
  const vertical = (c: number, r: number): Side => {
    if (c <= 0 || c >= cols) return { out: 0, seed: 0 };
    const e = edge(s, 1, c, r);
    return { out: e.sign, seed: e.seed };
  };

  const pieces: Piece[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const above = horizontal(row, col);
      const below = horizontal(row + 1, col);
      const left = vertical(col, row);
      const right = vertical(col + 1, row);
      pieces.push({
        id: row * cols + col,
        col,
        row,
        x: col * cellW,
        y: row * cellH,
        // A tab on one piece is the blank on its neighbour, so the sign flips across the edge.
        top: { out: -above.out as Side["out"], seed: above.seed },
        bottom: { out: below.out, seed: below.seed },
        left: { out: -left.out as Side["out"], seed: left.seed },
        right: { out: right.out, seed: right.seed },
      });
    }
  }
  return { count, cols, rows, cellW, cellH, width, height, pieces };
}

/** Shape of a tab, from its seed: where the neck sits, how wide and how tall the knob is. */
function tabShape(seed: number): { neck: number; halfWidth: number; height: number } {
  const rng = createRng(seed);
  return {
    neck: 0.33 + rng() * 0.07,
    halfWidth: 0.11 + rng() * 0.05,
    height: 0.2 + rng() * 0.07,
  };
}

/**
 * One side's steps, from its start corner to its end corner, in piece-local pixels. Tabs and
 * blanks are the same curve mirrored, so they fit.
 */
export function sideSteps(
  side: Side,
  cellW: number,
  cellH: number,
  corner: "top" | "right" | "bottom" | "left",
): Step[] {
  const n = Math.min(cellW, cellH);
  // Map a point on the side's own axis (u along the edge, v outward) into piece-local pixels.
  const map = (u: number, v: number): number[] => {
    switch (corner) {
      case "top":
        return [u * cellW, -v * n];
      case "right":
        return [cellW + v * n, u * cellH];
      case "bottom":
        return [cellW - u * cellW, cellH + v * n];
      case "left":
        return [-v * n, cellH - u * cellH];
    }
  };
  if (side.out === 0) {
    return [{ op: "L", pts: map(1, 0) }];
  }
  const { neck, halfWidth, height } = tabShape(side.seed);
  const o = side.out;
  // Local curve from (0,0) to (1,0), with the knob pointing along +v. Mirrored when the side dents in.
  const curve: [number[], number[], number[]][] = [
    [[neck + 0.05, 0], [0.5 - halfWidth, height], [0.5, height]],
    [[0.5 + halfWidth, height], [1 - neck - 0.05, 0], [1 - neck, 0]],
  ];
  const steps: Step[] = [{ op: "L", pts: map(neck, 0) }];
  for (const [c1, c2, end] of curve) {
    steps.push({
      op: "C",
      pts: [...map(c1[0]!, c1[1]! * o), ...map(c2[0]!, c2[1]! * o), ...map(end[0]!, end[1]! * o)],
    });
  }
  steps.push({ op: "L", pts: map(1, 0) });
  return steps;
}

/** The closed outline of a piece, starting and ending at its top-left corner. */
export function outline(puzzle: Puzzle, piece: Piece): Step[] {
  const { cellW, cellH } = puzzle;
  return [
    { op: "M", pts: [0, 0] },
    ...sideSteps(piece.top, cellW, cellH, "top"),
    ...sideSteps(piece.right, cellW, cellH, "right"),
    ...sideSteps(piece.bottom, cellW, cellH, "bottom"),
    ...sideSteps(piece.left, cellW, cellH, "left"),
  ];
}
