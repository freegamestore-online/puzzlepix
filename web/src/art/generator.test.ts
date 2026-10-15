import { afterEach, describe, expect, it, vi } from "vitest";
import { generateImage, packFor, PACKS, renderPixels } from "./generator";
import { PICTURE_COUNT, PICTURES } from "./pictures";

const SIZE = 48;

function distinctColours(pixels: Uint8ClampedArray): number {
  const seen = new Set<number>();
  for (let i = 0; i < pixels.length; i += 4) {
    seen.add((pixels[i]! << 16) | (pixels[i + 1]! << 8) | pixels[i + 2]!);
  }
  return seen.size;
}

describe("renderPixels", () => {
  it("gives the same pixels for the same seed, every time", () => {
    for (const seed of [0, 1, 7, 42, 1234]) {
      expect(renderPixels(seed, SIZE, SIZE)).toEqual(renderPixels(seed, SIZE, SIZE));
    }
  });

  it("gives different pixels for different seeds in the same pack", () => {
    const a = renderPixels(0, SIZE, SIZE);
    const b = renderPixels(4, SIZE, SIZE);
    expect(packFor(0)).toBe(packFor(4));
    expect(a).not.toEqual(b);
  });

  it("returns four opaque bytes per pixel", () => {
    const pixels = renderPixels(3, 20, 10);
    expect(pixels.length).toBe(20 * 10 * 4);
    for (let i = 3; i < pixels.length; i += 4) expect(pixels[i]).toBe(255);
  });

  it("renders every catalogue picture without error, with more than one colour", () => {
    for (const picture of PICTURES) {
      const pixels = renderPixels(picture.seed, SIZE, SIZE);
      expect(pixels.length).toBe(SIZE * SIZE * 4);
      expect(distinctColours(pixels), `picture ${picture.id} (${picture.pack})`).toBeGreaterThan(1);
    }
  });

  it("renders the same bytes for a seed no matter which picture asked for it", () => {
    expect(renderPixels(PICTURES[17]!.seed, SIZE, SIZE)).toEqual(renderPixels(17, SIZE, SIZE));
  });

  it("uses every pack", () => {
    const used = new Set(PICTURES.map((picture) => picture.pack));
    expect([...used].sort()).toEqual([...PACKS].sort());
  });

  it("rejects sizes that are not whole, positive numbers", () => {
    expect(() => renderPixels(1, 0, 10)).toThrow(RangeError);
    expect(() => renderPixels(1, 10.5, 10)).toThrow(RangeError);
    expect(() => renderPixels(1, 10, -1)).toThrow(RangeError);
  });
});

describe("generateImage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** A stand-in 2D context that keeps whatever is put onto it, since jsdom has no canvas. */
  function stubContext() {
    const puts: Uint8ClampedArray[] = [];
    const ctx = {
      createImageData: (width: number, height: number) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }),
      putImageData: (image: { data: Uint8ClampedArray }) => {
        puts.push(image.data.slice());
      },
    };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    return puts;
  }

  it("draws the same pixels as renderPixels, at the requested size", () => {
    const puts = stubContext();
    const canvas = generateImage(9, 64, 32);
    expect(canvas.width).toBe(64);
    expect(canvas.height).toBe(32);
    expect(puts).toHaveLength(1);
    expect(puts[0]).toEqual(renderPixels(9, 64, 32));
  });

  it("draws identical pixels for the same seed", () => {
    const puts = stubContext();
    generateImage(PICTURE_COUNT - 1, SIZE, SIZE);
    generateImage(PICTURE_COUNT - 1, SIZE, SIZE);
    expect(puts[0]).toEqual(puts[1]);
  });
});
