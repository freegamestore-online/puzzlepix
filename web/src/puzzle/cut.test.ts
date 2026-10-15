import { describe, expect, it } from "vitest";
import { cutPuzzle, gridFor, outline, PIECE_COUNTS, sideSteps, type Puzzle, type Side } from "./cut";

const SIZE = 512;

/** Absolute points of one side of a piece, from the start corner through to the end. */
function absolutePoints(puzzle: Puzzle, id: number, corner: "top" | "right" | "bottom" | "left"): [number, number][] {
  const piece = puzzle.pieces[id]!;
  const side: Side = piece[corner];
  // sideSteps starts where the previous side ended, so add that start corner here.
  const start = {
    top: [0, 0],
    right: [puzzle.cellW, 0],
    bottom: [puzzle.cellW, puzzle.cellH],
    left: [0, puzzle.cellH],
  }[corner];
  const points: [number, number][] = [[piece.x + start[0]!, piece.y + start[1]!]];
  for (const step of sideSteps(side, puzzle.cellW, puzzle.cellH, corner)) {
    for (let i = 0; i < step.pts.length; i += 2) {
      points.push([piece.x + step.pts[i]!, piece.y + step.pts[i + 1]!]);
    }
  }
  return points;
}

describe("gridFor", () => {
  it.each(PIECE_COUNTS)("%i pieces make a whole grid with sides at most 3:1 apart", (count) => {
    for (const aspect of [1, 16 / 9, 3 / 4]) {
      const { cols, rows } = gridFor(count, aspect * 100, 100);
      expect(cols * rows).toBe(count);
      expect(Math.max(cols, rows) / Math.min(cols, rows)).toBeLessThanOrEqual(3);
    }
  });

  it("follows the picture's shape", () => {
    const wide = gridFor(24, 1600, 900);
    const tall = gridFor(24, 900, 1600);
    expect(wide.cols).toBeGreaterThan(wide.rows);
    expect(tall.rows).toBeGreaterThan(tall.cols);
  });
});

describe("cutPuzzle", () => {
  it.each(PIECE_COUNTS)("cuts %i pieces", (count) => {
    const puzzle = cutPuzzle(5, count, SIZE, SIZE);
    expect(puzzle.pieces).toHaveLength(count);
    expect(puzzle.pieces.map((p) => p.id)).toEqual(puzzle.pieces.map((_, i) => i));
  });

  it.each(PIECE_COUNTS)("gives every one of %i pieces a unique correct position inside the board", (count) => {
    const puzzle = cutPuzzle(5, count, SIZE, SIZE);
    const spots = new Set(puzzle.pieces.map((p) => `${p.x},${p.y}`));
    expect(spots.size).toBe(count);
    for (const p of puzzle.pieces) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.x + puzzle.cellW).toBeLessThanOrEqual(SIZE + 1e-9);
      expect(p.y + puzzle.cellH).toBeLessThanOrEqual(SIZE + 1e-9);
    }
  });

  it("covers the whole board: the cells add up to its area", () => {
    const puzzle = cutPuzzle(5, 48, SIZE, SIZE);
    expect(puzzle.pieces.length * puzzle.cellW * puzzle.cellH).toBeCloseTo(SIZE * SIZE, 6);
  });

  it("leaves the picture's outer edge flat and cuts every inner edge", () => {
    const puzzle = cutPuzzle(5, 24, SIZE, SIZE);
    for (const p of puzzle.pieces) {
      expect(p.top.out === 0).toBe(p.row === 0);
      expect(p.bottom.out === 0).toBe(p.row === puzzle.rows - 1);
      expect(p.left.out === 0).toBe(p.col === 0);
      expect(p.right.out === 0).toBe(p.col === puzzle.cols - 1);
    }
  });

  it("makes each tab the blank on its neighbour, with the same shape seed", () => {
    const puzzle = cutPuzzle(5, 24, SIZE, SIZE);
    for (const p of puzzle.pieces) {
      if (p.col < puzzle.cols - 1) {
        const q = puzzle.pieces[p.id + 1]!;
        expect(q.left.out).toBe(-p.right.out);
        expect(q.left.seed).toBe(p.right.seed);
      }
      if (p.row < puzzle.rows - 1) {
        const q = puzzle.pieces[p.id + puzzle.cols]!;
        expect(q.top.out).toBe(-p.bottom.out);
        expect(q.top.seed).toBe(p.bottom.seed);
      }
    }
  });

  it("fits each tab exactly into its neighbour's blank", () => {
    const puzzle = cutPuzzle(9, 12, SIZE, SIZE);
    for (const p of puzzle.pieces) {
      if (p.col < puzzle.cols - 1) {
        const mine = absolutePoints(puzzle, p.id, "right");
        const theirs = absolutePoints(puzzle, p.id + 1, "left");
        for (const [x, y] of mine) {
          const close = theirs.some(([tx, ty]) => Math.abs(tx - x) < 1e-6 && Math.abs(ty - y) < 1e-6);
          expect(close, `point ${x},${y} of piece ${p.id}`).toBe(true);
        }
      }
    }
  });

  it("is the same for the same seed, and different for another", () => {
    expect(cutPuzzle(42, 96, SIZE, SIZE)).toEqual(cutPuzzle(42, 96, SIZE, SIZE));
    expect(cutPuzzle(42, 96, SIZE, SIZE)).not.toEqual(cutPuzzle(43, 96, SIZE, SIZE));
  });

  it("draws every piece as a closed outline that starts and ends at its corner", () => {
    const puzzle = cutPuzzle(3, 150, SIZE, SIZE);
    for (const piece of puzzle.pieces) {
      const steps = outline(puzzle, piece);
      expect(steps[0]!.op).toBe("M");
      const last = steps[steps.length - 1]!.pts;
      expect(last[0]).toBeCloseTo(0, 9);
      expect(last[1]).toBeCloseTo(0, 9);
      for (const step of steps) for (const v of step.pts) expect(Number.isFinite(v)).toBe(true);
    }
  });
});
