import { describe, expect, it } from "vitest";
import { cutPuzzle, type Puzzle } from "./cut";
import {
  drop,
  groupOf,
  isSolved,
  layoutTray,
  rotatePiece,
  snapGroup,
  snapThreshold,
  stageSize,
  TRAY_GAP,
  type Placement,
  type Placements,
} from "./board";

const SIZE = 400;

/** Every piece placed exactly where the cut says it belongs. */
function solvedPlacements(puzzle: Puzzle): Placement[] {
  return puzzle.pieces.map((p) => ({ x: p.x, y: p.y, rotation: 0 }));
}

/** A copy of `placements` with one piece's placement changed. */
function withPlacement(placements: Placements, id: number, next: Partial<Placement>): Placement[] {
  const copy = placements.slice();
  copy[id] = { ...copy[id]!, ...next };
  return copy;
}

describe("snapGroup", () => {
  const puzzle = cutPuzzle(1, 12, SIZE, SIZE);
  const threshold = snapThreshold(puzzle);
  const piece = puzzle.pieces[5]!;

  it("snaps a piece to its correct place when it is within the threshold", () => {
    const placements = withPlacement(solvedPlacements(puzzle), 5, {
      x: piece.x + threshold * 0.6,
      y: piece.y - threshold * 0.5,
    });
    const result = snapGroup(puzzle, placements, 5, threshold);
    expect(result.snapped).toBe(true);
    expect(result.placements[5]!.x).toBeCloseTo(piece.x, 9);
    expect(result.placements[5]!.y).toBeCloseTo(piece.y, 9);
  });

  it("leaves a piece alone when it is beyond the threshold", () => {
    const placements = withPlacement(solvedPlacements(puzzle), 5, { x: piece.x + threshold * 1.5, y: piece.y });
    const result = snapGroup(puzzle, placements, 5, threshold);
    expect(result.snapped).toBe(false);
    expect(result.placements[5]!.x).toBeCloseTo(piece.x + threshold * 1.5, 9);
  });

  it("does not snap a piece that is turned", () => {
    const placements = withPlacement(solvedPlacements(puzzle), 5, { rotation: 1 });
    expect(snapGroup(puzzle, placements, 5, threshold).snapped).toBe(false);
  });

  it("snaps a piece to the place its cut gives beside a neighbour that is off the board", () => {
    // Piece 4 is the left neighbour of piece 5 and is moved off its place. Piece 5 is put just short
    // of where the cut puts it beside 4, which is far from its own correct place.
    const offset = 150;
    const shifted = withPlacement(solvedPlacements(puzzle), 4, {
      x: puzzle.pieces[4]!.x + offset,
      y: puzzle.pieces[4]!.y,
    });
    const target = {
      x: shifted[4]!.x + (puzzle.pieces[5]!.x - puzzle.pieces[4]!.x),
      y: shifted[4]!.y + (puzzle.pieces[5]!.y - puzzle.pieces[4]!.y),
    };
    const placements = withPlacement(shifted, 5, { x: target.x + threshold * 0.4, y: target.y });
    const result = snapGroup(puzzle, placements, 5, threshold);
    expect(result.snapped).toBe(true);
    expect(result.placements[5]!.x).toBeCloseTo(target.x, 9);
    expect(groupOf(puzzle, result.placements, 5)).toContain(4);
  });
});

describe("drop and groups", () => {
  const puzzle = cutPuzzle(2, 12, SIZE, SIZE);
  const threshold = snapThreshold(puzzle);

  it("moves a joined group together, so its pieces stay joined", () => {
    const dropped = drop(puzzle, solvedPlacements(puzzle), 0, 300, 300, threshold);
    expect(dropped.snapped).toBe(false);
    expect(groupOf(puzzle, dropped.placements, 0)).toContain(1);
    expect(dropped.placements[1]!.x - dropped.placements[0]!.x).toBeCloseTo(puzzle.cellW, 9);
  });

  it("merges all connected pieces when a group snaps into a group beside it", () => {
    // A 4-wide grid. Pieces 0 and 1 are a pair in row 0. Pieces 4 and 5 are the pair under them in row 1.
    const grid = cutPuzzle(4, 24, SIZE, SIZE);
    const t = snapThreshold(grid);
    const at = (id: number) => grid.pieces[id]!;
    const pair = [0, 1];
    const below = [grid.cols, grid.cols + 1];

    // Every other piece is parked far off the board, so only these two pairs can join.
    // The lower pair is moved off its place as a whole. The upper pair stays where it is.
    const offset = 120;
    const placements: Placement[] = grid.pieces.map((p) => ({ x: 2000 + p.id * 100, y: 2000, rotation: 0 }));
    for (const id of pair) placements[id] = { x: at(id).x, y: at(id).y, rotation: 0 };
    for (const id of below) placements[id] = { x: at(id).x + offset, y: at(id).y, rotation: 0 };

    // Drag the upper pair so piece 1 lands just short of its cut place beside the lower pair.
    const nudge = t * 0.3;
    const dropped = drop(grid, placements, 1, offset + nudge, nudge, t);
    expect(dropped.snapped).toBe(true);

    const merged = [...pair, ...below].sort((a, b) => a - b);
    for (const id of merged) expect(groupOf(grid, dropped.placements, id)).toEqual(merged);
  });

  it("does not join a turned piece to its neighbours", () => {
    const placements = withPlacement(solvedPlacements(puzzle), 1, { rotation: 2 });
    expect(groupOf(puzzle, placements, 0)).not.toContain(1);
    expect(groupOf(puzzle, placements, 1)).toEqual([1]);
  });
});

describe("rotatePiece", () => {
  const puzzle = cutPuzzle(6, 12, SIZE, SIZE);

  it("turns a single piece a quarter turn at a time", () => {
    // Move every other piece far away so piece 0 is on its own.
    let placements: Placement[] = solvedPlacements(puzzle).map((p, i) => (i === 0 ? p : { ...p, x: p.x + 1000 }));
    for (const expected of [1, 2, 3, 0]) {
      placements = rotatePiece(puzzle, placements, 0);
      expect(placements[0]!.rotation).toBe(expected);
    }
  });

  it("does not turn a piece that is joined to another", () => {
    const placements = solvedPlacements(puzzle);
    expect(groupOf(puzzle, placements, 0)).toContain(1);
    expect(rotatePiece(puzzle, placements, 0)[0]!.rotation).toBe(0);
  });
});

describe("isSolved", () => {
  it("is true only when every piece is upright in its correct place", () => {
    const puzzle = cutPuzzle(7, 24, SIZE, SIZE);
    const solved = solvedPlacements(puzzle);
    expect(isSolved(puzzle, solved)).toBe(true);
    expect(isSolved(puzzle, withPlacement(solved, 3, { x: solved[3]!.x + 5 }))).toBe(false);
    expect(isSolved(puzzle, withPlacement(solved, 3, { rotation: 1 }))).toBe(false);
  });
});

describe("layoutTray", () => {
  const puzzle = cutPuzzle(8, 48, SIZE, SIZE);
  const trayY = SIZE + TRAY_GAP;

  it("scatters every piece inside the tray, and the same seed gives the same layout", () => {
    const layout = layoutTray(puzzle, "scatter", 8, false);
    expect(layout).toHaveLength(puzzle.pieces.length);
    for (const p of layout) {
      expect(p.y).toBeGreaterThanOrEqual(trayY);
      expect(p.y + puzzle.cellH).toBeLessThanOrEqual(stageSize(puzzle).height + 1e-9);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x + puzzle.cellW).toBeLessThanOrEqual(SIZE + 1e-9);
    }
    expect(layoutTray(puzzle, "scatter", 8, false)).toEqual(layout);
  });

  it("puts the edge pieces first in edges mode", () => {
    const layout = layoutTray(puzzle, "edges", 8, false);
    // Row-major order of the tray slots: a smaller key means earlier in the tray.
    const key = (p: Placement) => p.y * 10000 + p.x;
    const isEdge = (id: number) => {
      const { row, col } = puzzle.pieces[id]!;
      return row === 0 || col === 0 || row === puzzle.rows - 1 || col === puzzle.cols - 1;
    };
    const ids = puzzle.pieces.map((p) => p.id);
    const edges = ids.filter(isEdge);
    const interior = ids.filter((id) => !isEdge(id));
    expect(Math.max(...edges.map((id) => key(layout[id]!)))).toBeLessThan(
      Math.min(...interior.map((id) => key(layout[id]!))),
    );
  });

  it("turns pieces at random only when rotations are on", () => {
    expect(layoutTray(puzzle, "scatter", 8, false).every((p) => p.rotation === 0)).toBe(true);
    expect(layoutTray(puzzle, "scatter", 8, true).some((p) => p.rotation !== 0)).toBe(true);
  });
});
