import { describe, expect, it } from "vitest";
import { cutPuzzle, type Puzzle } from "./cut";
import { groupOf, isSolved, layoutTray, type Placement } from "./board";
import { edgeIds, hintPlacements } from "./helpers";

const SIZE = 400;

function solvedPlacements(puzzle: Puzzle): Placement[] {
  return puzzle.pieces.map((p) => ({ x: p.x, y: p.y, rotation: 0 }));
}

describe("edgeIds", () => {
  it("lists exactly the pieces on the outside of the picture", () => {
    const puzzle = cutPuzzle(3, 48, SIZE, SIZE);
    const ids = edgeIds(puzzle);
    expect(ids).toHaveLength(2 * (puzzle.cols + puzzle.rows) - 4);
    for (const id of ids) {
      const { row, col } = puzzle.pieces[id]!;
      expect(row === 0 || col === 0 || row === puzzle.rows - 1 || col === puzzle.cols - 1).toBe(true);
    }
  });
});

describe("hintPlacements", () => {
  const puzzle = cutPuzzle(4, 24, SIZE, SIZE);

  it("does nothing once the puzzle is solved", () => {
    expect(hintPlacements(puzzle, solvedPlacements(puzzle))).toBeNull();
  });

  it("puts one misplaced piece onto its spot and leaves the rest as they were", () => {
    const start = layoutTray(puzzle, "scatter", 4, false);
    const next = hintPlacements(puzzle, start)!;
    const changed = next.map((p, i) => (p === start[i] ? -1 : i)).filter((i) => i >= 0);
    expect(changed).toHaveLength(1);
    const piece = puzzle.pieces[changed[0]!]!;
    expect(next[piece.id]).toEqual({ x: piece.x, y: piece.y, rotation: 0 });
  });

  it("repeated hints finish the puzzle", () => {
    let placements: Placement[] | null = layoutTray(puzzle, "edges", 4, true);
    let hints = 0;
    while (placements && !isSolved(puzzle, placements)) {
      placements = hintPlacements(puzzle, placements);
      hints++;
    }
    expect(placements && isSolved(puzzle, placements)).toBe(true);
    expect(hints).toBeLessThanOrEqual(puzzle.pieces.length);
  });

  it("picks a lone piece over one that is joined to another", () => {
    // Pieces 0 and 1 are a joined pair, moved away together. The last piece is alone, also moved away.
    const placements = solvedPlacements(puzzle);
    for (const id of [0, 1]) placements[id] = { x: puzzle.pieces[id]!.x + 300, y: puzzle.pieces[id]!.y, rotation: 0 };
    const last = puzzle.pieces.length - 1;
    placements[last] = { x: puzzle.pieces[last]!.x + 300, y: puzzle.pieces[last]!.y, rotation: 0 };
    expect(groupOf(puzzle, placements, 0)).toEqual([0, 1]);
    expect(groupOf(puzzle, placements, last)).toEqual([last]);

    const next = hintPlacements(puzzle, placements)!;
    expect(next[last]).toEqual({ x: puzzle.pieces[last]!.x, y: puzzle.pieces[last]!.y, rotation: 0 });
    expect(next[0]).toEqual(placements[0]);
    expect(next[1]).toEqual(placements[1]);
  });
});
