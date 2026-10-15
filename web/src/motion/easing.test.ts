// TODO: switch to @freegamestore/games/feel once published
import { describe, expect, it } from "vitest";
import { easeInOutQuad, easeInQuad, easeOutBack, easeOutCubic, easeOutQuad, linear, type Easing } from "./easing";

const CURVES: [string, Easing][] = [
  ["linear", linear],
  ["easeInQuad", easeInQuad],
  ["easeOutQuad", easeOutQuad],
  ["easeOutCubic", easeOutCubic],
  ["easeInOutQuad", easeInOutQuad],
  ["easeOutBack", easeOutBack()],
];

describe("easing curves", () => {
  it.each(CURVES)("%s starts at 0 and ends at 1", (_name, ease) => {
    expect(ease(0)).toBeCloseTo(0, 9);
    expect(ease(1)).toBeCloseTo(1, 9);
  });

  it("easeOutQuad is ahead of linear for the whole move, so it feels responsive", () => {
    for (const t of [0.1, 0.25, 0.5, 0.75, 0.9]) {
      expect(easeOutQuad(t)).toBeGreaterThan(t);
    }
  });

  it("easeInQuad is behind linear, so it starts slowly", () => {
    for (const t of [0.1, 0.5, 0.9]) {
      expect(easeInQuad(t)).toBeLessThan(t);
    }
  });

  it("easeInOutQuad is symmetric about the midpoint", () => {
    expect(easeInOutQuad(0.5)).toBeCloseTo(0.5, 9);
    expect(easeInOutQuad(0.2) + easeInOutQuad(0.8)).toBeCloseTo(1, 9);
  });

  it("easeOutBack overshoots 1 before it settles", () => {
    const peak = Math.max(...Array.from({ length: 101 }, (_, i) => easeOutBack()(i / 100)));
    expect(peak).toBeGreaterThan(1);
    expect(easeOutBack()(1)).toBeCloseTo(1, 9);
  });

  it("curves that never overshoot stay between 0 and 1", () => {
    for (const [, ease] of CURVES.filter(([name]) => name !== "easeOutBack")) {
      for (let i = 0; i <= 100; i++) {
        const v = ease(i / 100);
        expect(v).toBeGreaterThanOrEqual(-1e-9);
        expect(v).toBeLessThanOrEqual(1 + 1e-9);
      }
    }
  });
});
