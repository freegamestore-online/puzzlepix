// TODO: switch to @freegamestore/games/feel once published
import { describe, expect, it } from "vitest";
import { shakeKeyframes } from "./shake";

const offsetX = (transform: string) => Number(/translate3d\((-?[\d.]+)px/.exec(transform)?.[1] ?? 0);

describe("shakeKeyframes", () => {
  it("starts and ends at rest", () => {
    const frames = shakeKeyframes(4);
    expect(frames[0]?.transform).toBe("translate3d(0, 0, 0)");
    expect(frames.at(-1)?.transform).toBe("translate3d(0, 0, 0)");
  });

  it("swings both ways and decays, so the last swing is smaller than the first", () => {
    const swings = shakeKeyframes(4).map((f) => offsetX(String(f.transform)));
    expect(Math.max(...swings)).toBeGreaterThan(0);
    expect(Math.min(...swings)).toBeLessThan(0);
    expect(Math.abs(swings[5] ?? 0)).toBeLessThan(Math.abs(swings[1] ?? 0));
  });

  it("never swings further than the amplitude", () => {
    for (const frame of shakeKeyframes(4)) {
      expect(Math.abs(offsetX(String(frame.transform)))).toBeLessThanOrEqual(4);
    }
  });

  it("keeps offsets in ascending order from 0 to 1", () => {
    const offsets = shakeKeyframes(4).map((f) => f.offset as number);
    expect(offsets[0]).toBe(0);
    expect(offsets.at(-1)).toBe(1);
    expect([...offsets].sort((a, b) => a - b)).toEqual(offsets);
  });
});
