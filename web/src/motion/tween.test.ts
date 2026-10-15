// TODO: switch to @freegamestore/games/feel once published
import { describe, expect, it } from "vitest";
import { linear } from "./easing";
import { tweenProgress, tweenValue } from "./tween";

describe("tweenProgress", () => {
  it("runs from 0 to 1 over the duration and clamps outside it", () => {
    expect(tweenProgress(0, 200)).toBe(0);
    expect(tweenProgress(100, 200)).toBe(0.5);
    expect(tweenProgress(200, 200)).toBe(1);
    expect(tweenProgress(999, 200)).toBe(1);
    expect(tweenProgress(-50, 200)).toBe(0);
  });

  it("is already finished for a zero or negative duration", () => {
    expect(tweenProgress(0, 0)).toBe(1);
    expect(tweenProgress(0, -10)).toBe(1);
  });
});

describe("tweenValue", () => {
  it("moves from one value to the other across the duration", () => {
    expect(tweenValue(10, 30, 0, 100, linear)).toBe(10);
    expect(tweenValue(10, 30, 50, 100, linear)).toBe(20);
    expect(tweenValue(10, 30, 100, 100, linear)).toBe(30);
  });

  it("applies the easing curve, so the midpoint is not the linear midpoint by default", () => {
    // easeOutQuad at t = 0.5 is 0.75, so 0 → 100 reads 75 halfway through.
    expect(tweenValue(0, 100, 50, 100)).toBeCloseTo(75, 9);
  });

  it("returns the target at once for a zero duration", () => {
    expect(tweenValue(0, 40, 0, 0)).toBe(40);
  });
});
