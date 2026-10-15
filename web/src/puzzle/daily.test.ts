import { describe, expect, it } from "vitest";
import { dailyPuzzle, DAILY_COUNT } from "./daily";

describe("dailyPuzzle", () => {
  it("gives the same picture, cut and seed for the same day", () => {
    const a = dailyPuzzle("2026-10-16");
    const b = dailyPuzzle("2026-10-16");
    expect(a).toEqual(b);
  });

  it("always cuts the daily count", () => {
    expect(dailyPuzzle("2026-10-16").puzzle.pieces).toHaveLength(DAILY_COUNT);
  });

  it("changes the cut from one day to the next", () => {
    expect(dailyPuzzle("2026-10-16").seed).not.toBe(dailyPuzzle("2026-10-17").seed);
  });
});
