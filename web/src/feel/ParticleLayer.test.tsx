// TODO: switch to @freegamestore/games/feel once published
import { act, render } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ParticleLayer, type ParticleLayerHandle } from "./ParticleLayer";

const BURST = { count: 5, speed: [100, 200] as const, size: [4, 6] as const, life: 0.5 };

function setReducedMotion(reduce: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reduce && query.includes("reduce"),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

function renderLayer() {
  const ref = createRef<ParticleLayerHandle>();
  const { container } = render(<ParticleLayer ref={ref} />);
  const canvas = container.querySelector("canvas") as HTMLCanvasElement;
  return { ref, canvas };
}

describe("ParticleLayer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setReducedMotion(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts empty and is hidden from assistive technology", () => {
    const { canvas } = renderLayer();
    expect(canvas.dataset.particles).toBe("0");
    expect(canvas).toHaveAttribute("aria-hidden", "true");
  });

  it("holds the particles from a burst until they expire", () => {
    const { ref, canvas } = renderLayer();

    act(() => ref.current?.burst(50, 50, ["red"], BURST));
    // The count is published by the next frame, so run one.
    act(() => {
      vi.advanceTimersByTime(20);
    });
    expect(canvas.dataset.particles).toBe("5");

    // Advance well past the 0.5 s life.
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(canvas.dataset.particles).toBe("0");
  });

  it("launches nothing under reduced motion", () => {
    setReducedMotion(true);
    const { ref, canvas } = renderLayer();

    act(() => ref.current?.burst(50, 50, ["red"], BURST));
    expect(canvas.dataset.particles).toBe("0");
  });
});
