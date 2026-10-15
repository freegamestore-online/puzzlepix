import { describe, expect, it } from "vitest";
import { cutPuzzle } from "../puzzle/cut";
import { drop, isSolved, layoutTray, snapThreshold, type Placement } from "../puzzle/board";
import {
  dailyScore,
  loadSaves,
  restorePlacements,
  saveSaves,
  SAVES_KEY,
  shouldSubmitDaily,
  type DailyRecord,
} from "./saves";

/** An in-memory stand-in for localStorage. */
function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    raw: (key: string) => data.get(key),
  };
}

describe("saving and resuming a puzzle", () => {
  const puzzle = cutPuzzle(11, 24, 512, 512);
  const count = puzzle.pieces.length;

  it("restores the piece positions exactly after a save and a reload", () => {
    // Put some pieces on the board, some in the tray, and turn one.
    let placements: Placement[] = layoutTray(puzzle, "scatter", 11, true);
    for (const id of [0, 1, 2]) {
      const piece = puzzle.pieces[id]!;
      placements = placements.map((p, i) => (i === id ? { x: piece.x, y: piece.y, rotation: 0 } : p));
    }
    placements = drop(puzzle, placements, 2, 40.25, -13.5, snapThreshold(puzzle)).placements;

    const storage = memoryStorage();
    saveSaves({ puzzles: { k: { placements } }, daily: {} }, storage);
    const reloaded = loadSaves(storage);

    expect(restorePlacements(reloaded.puzzles.k, count)).toEqual(placements);
  });

  it("returns nothing to resume when the saved piece count does not match", () => {
    const saved = { placements: layoutTray(puzzle, "scatter", 11, false) };
    expect(restorePlacements(saved, count + 1)).toBeNull();
    expect(restorePlacements(undefined, count)).toBeNull();
  });

  it("keeps a resumed solved puzzle solved", () => {
    const solved = puzzle.pieces.map((p) => ({ x: p.x, y: p.y, rotation: 0 as const }));
    const storage = memoryStorage();
    saveSaves({ puzzles: { k: { placements: solved } }, daily: {} }, storage);
    const resumed = restorePlacements(loadSaves(storage).puzzles.k, count)!;
    expect(isSolved(puzzle, resumed)).toBe(true);
  });
});

describe("loadSaves", () => {
  it("starts empty when nothing is saved or the save is unreadable", () => {
    expect(loadSaves(memoryStorage())).toEqual({ puzzles: {}, daily: {} });
    expect(loadSaves(memoryStorage({ [SAVES_KEY]: "{not json" }))).toEqual({ puzzles: {}, daily: {} });
    expect(loadSaves(memoryStorage({ [SAVES_KEY]: "42" }))).toEqual({ puzzles: {}, daily: {} });
  });

  it("drops bad entries and keeps good ones", () => {
    const storage = memoryStorage({
      [SAVES_KEY]: JSON.stringify({
        puzzles: {
          good: { placements: [{ x: 1, y: 2, rotation: 3 }] },
          badRotation: { placements: [{ x: 1, y: 2, rotation: 7 }] },
          badNumber: { placements: [{ x: "1", y: 2, rotation: 0 }] },
          notArray: { placements: 5 },
        },
        daily: {
          day: { startedAt: 100 },
          broken: { startedAt: "soon" },
        },
      }),
    });
    const saves = loadSaves(storage);
    expect(Object.keys(saves.puzzles)).toEqual(["good"]);
    expect(Object.keys(saves.daily)).toEqual(["day"]);
  });
});

describe("daily completions for the leaderboard", () => {
  const solvedClean: DailyRecord = { startedAt: 0, solvedMs: 90_000 };

  it("submits a clean solve once", () => {
    expect(shouldSubmitDaily(solvedClean)).toBe(true);
  });

  it("never submits an unsolved puzzle", () => {
    expect(shouldSubmitDaily({ startedAt: 0 })).toBe(false);
    expect(shouldSubmitDaily(undefined)).toBe(false);
  });

  it("never submits a solve that used a hint", () => {
    expect(shouldSubmitDaily({ ...solvedClean, hinted: true })).toBe(false);
  });

  it("never submits the same solve twice", () => {
    expect(shouldSubmitDaily({ ...solvedClean, submitted: true })).toBe(false);
  });

  it("scores faster times higher, and never below zero", () => {
    expect(dailyScore(60_000)).toBeGreaterThan(dailyScore(120_000));
    expect(dailyScore(1e12)).toBe(0);
  });
});
