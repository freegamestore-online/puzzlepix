// TODO: switch to @freegamestore/games/feel once published
import { render, screen } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SCORE_POP_MS, ScorePop } from "./ScorePop";

function setReducedMotion(reduce: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reduce && query.includes("reduce"),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

describe("ScorePop", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setReducedMotion(false);
  });

  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(window, "matchMedia");
  });

  it("renders the points as +N", () => {
    render(<ScorePop points={300} x={10} y={20} onDone={() => {}} />);
    expect(screen.getByText("+300")).toBeInTheDocument();
  });

  it("rises and fades, then calls onDone once it has finished", () => {
    const onDone = vi.fn();
    render(<ScorePop points={300} x={10} y={20} onDone={onDone} />);
    const pop = screen.getByText("+300");

    act(() => {
      vi.advanceTimersByTime(SCORE_POP_MS / 2);
    });
    expect(pop.style.transform).toContain("calc(-50% + -");
    expect(Number(pop.style.opacity)).toBeLessThan(1);
    expect(onDone).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(SCORE_POP_MS);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("under reduced motion holds still, shows the number, and still calls onDone", () => {
    setReducedMotion(true);
    const onDone = vi.fn();
    render(<ScorePop points={300} x={10} y={20} onDone={onDone} />);
    const pop = screen.getByText("+300");

    act(() => {
      vi.advanceTimersByTime(SCORE_POP_MS / 2);
    });
    expect(pop.style.opacity).toBe("");
    expect(pop.style.transform).toBe("translate(-50%, -50%)");
    expect(onDone).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(SCORE_POP_MS);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
