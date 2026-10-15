// TODO: switch to @freegamestore/games/feel once published
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flyTo, type Box } from "./flight";

const FROM: Box = { left: 0, top: 0, width: 60, height: 60 };
const TO: Box = { left: 100, top: 200, width: 30, height: 30 };

describe("flyTo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts at the old position and eases into place", () => {
    const el = document.createElement("div");
    flyTo(el, FROM, TO, { duration: 200 });

    vi.advanceTimersByTime(16);
    expect(el.style.transform).not.toBe("");
    expect(el.style.transform).not.toBe("translate(0px, 0px) scale(1)");
  });

  it("clears its transform and opacity once the flight is over", () => {
    const el = document.createElement("div");
    flyTo(el, FROM, TO, { duration: 200 });

    vi.advanceTimersByTime(300);
    expect(el.style.transform).toBe("");
    expect(el.style.opacity).toBe("");
  });

  it("stops and clears at once when cancelled", () => {
    const el = document.createElement("div");
    const cancel = flyTo(el, FROM, TO, { duration: 200 });

    vi.advanceTimersByTime(16);
    cancel();
    expect(el.style.transform).toBe("");

    vi.advanceTimersByTime(300);
    expect(el.style.transform).toBe("");
  });

  it("finishes straight away for a zero-length flight", () => {
    const el = document.createElement("div");
    flyTo(el, FROM, TO, { duration: 0 });

    vi.advanceTimersByTime(16);
    expect(el.style.transform).toBe("");
  });
});
