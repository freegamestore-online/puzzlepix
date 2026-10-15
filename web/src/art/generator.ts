import { createRng, hashInts, unit } from "./rng";

/** The themed packs. A seed always belongs to the same pack. */
export const PACKS = ["landscapes", "gradients", "geometric", "mosaic"] as const;
export type Pack = (typeof PACKS)[number];

type Rgb = readonly [number, number, number];

/** The colour at pixel (x, y). Built once per picture, then sampled for every pixel. */
type Scene = (x: number, y: number) => Rgb;

interface SceneContext {
  seed: number;
  width: number;
  height: number;
  /** Layout and palette draw from this in a fixed order, so the same seed gives the same scene. */
  rand: () => number;
}

const TAU = Math.PI * 2;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

/** Hue in degrees, saturation and lightness in [0, 1], to RGB in 0–255. */
function hsl(hue: number, saturation: number, lightness: number): Rgb {
  const h = ((hue % 360) + 360) % 360;
  const a = saturation * Math.min(lightness, 1 - lightness);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    return 255 * (lightness - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)));
  };
  return [channel(0), channel(8), channel(4)];
}

function randomColour(rand: () => number): Rgb {
  return hsl(rand() * 360, 0.5 + rand() * 0.3, 0.45 + rand() * 0.3);
}

/** Walk evenly spaced colour stops, with t in [0, 1]. */
function ramp(stops: readonly Rgb[], t: number): Rgb {
  const scaled = t * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(scaled));
  return lerpRgb(stops[i]!, stops[i + 1]!, scaled - i);
}

/** Sky, sun, and three hill ridges from back to front. Front ridges sit lower and darker. */
function landscape({ rand, width, height }: SceneContext): Scene {
  const hue = rand() * 360;
  const skyTop = hsl(hue, 0.55, 0.78);
  const skyBottom = hsl(hue + 35, 0.8, 0.94);
  const sun = hsl(hue + 50, 0.9, 0.72);
  const sunX = width * (0.2 + rand() * 0.6);
  const sunY = height * (0.12 + rand() * 0.25);
  const sunR = Math.min(width, height) * (0.05 + rand() * 0.06);

  const ridges = [0, 1, 2].map((layer) => {
    const base = height * (0.45 + layer * 0.14);
    const amp = height * (0.04 + rand() * 0.07);
    const f1 = 1 + rand() * 2;
    const f2 = 3 + rand() * 4;
    const p1 = rand() * TAU;
    const p2 = rand() * TAU;
    const tops = new Float64Array(width);
    for (let x = 0; x < width; x++) {
      tops[x] = base - amp * (0.6 * Math.sin((TAU * f1 * x) / width + p1) + 0.4 * Math.sin((TAU * f2 * x) / width + p2));
    }
    return { tops, colour: hsl(hue + 100 + layer * 25, 0.35 + layer * 0.05, 0.6 - layer * 0.12) };
  });

  return (x, y) => {
    let colour = lerpRgb(skyTop, skyBottom, y / height);
    if ((x - sunX) ** 2 + (y - sunY) ** 2 <= sunR * sunR) colour = sun;
    for (const ridge of ridges) {
      if (y >= ridge.tops[x]!) colour = ridge.colour;
    }
    return colour;
  };
}

/** A three-stop linear or radial blend. */
function gradient({ rand, width, height }: SceneContext): Scene {
  const stops = [randomColour(rand), randomColour(rand), randomColour(rand)];
  const radial = rand() < 0.5;
  const angle = rand() * TAU;
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);
  const cx = 0.3 + rand() * 0.4;
  const cy = 0.3 + rand() * 0.4;

  return (x, y) => {
    const u = x / width;
    const v = y / height;
    const t = radial
      ? Math.hypot(u - cx, v - cy) / 0.9
      : ((u - 0.5) * dirX + (v - 0.5) * dirY) / 1.414 + 0.5;
    return ramp(stops, Math.min(1, Math.max(0, t)));
  };
}

/** A grid of circles, squares and half-cell triangles on a plain ground. */
function geometric({ seed, rand, width, height }: SceneContext): Scene {
  // Cells are a share of the shorter side, so the picture looks the same at any size.
  const size = Math.min(width, height) * (1 / 12 + rand() * (1 / 6));
  const background = randomColour(rand);
  const palette = Array.from({ length: 4 }, () => randomColour(rand));

  return (x, y) => {
    const ci = Math.floor(x / size);
    const cj = Math.floor(y / size);
    const h = hashInts(seed, ci, cj);
    const fx = (x - ci * size) / size;
    const fy = (y - cj * size) / size;
    const shape = h % 3;
    const inside =
      shape === 0
        ? (fx - 0.5) ** 2 + (fy - 0.5) ** 2 < 0.2
        : shape === 1
          ? fx > 0.15 && fx < 0.85 && fy > 0.15 && fy < 0.85
          : (h >>> 16) & 1
            ? fy > fx
            : fy > 1 - fx;
    return inside ? palette[(h >>> 8) % palette.length]! : background;
  };
}

/** Voronoi cells around jittered grid points. Each cell takes its nearest point's colour. */
function mosaic({ seed, rand, width, height }: SceneContext): Scene {
  // Cells are a share of the shorter side, so the picture looks the same at any size.
  const cell = Math.min(width, height) * (0.1 + rand() * 0.1);
  const hue = rand() * 360;
  const palette = Array.from({ length: 6 }, () => hsl(hue + rand() * 120, 0.5 + rand() * 0.3, 0.45 + rand() * 0.3));

  return (x, y) => {
    const ci0 = Math.floor(x / cell);
    const cj0 = Math.floor(y / cell);
    let best = Infinity;
    let colour = palette[0]!;
    for (let cj = cj0 - 1; cj <= cj0 + 1; cj++) {
      for (let ci = ci0 - 1; ci <= ci0 + 1; ci++) {
        const px = (ci + unit(hashInts(seed, ci, cj, 1))) * cell;
        const py = (cj + unit(hashInts(seed, ci, cj, 2))) * cell;
        const d = (px - x) ** 2 + (py - y) ** 2;
        if (d < best) {
          best = d;
          colour = palette[hashInts(seed, ci, cj, 3) % palette.length]!;
        }
      }
    }
    return colour;
  };
}

const SCENES: Record<Pack, (ctx: SceneContext) => Scene> = {
  landscapes: landscape,
  gradients: gradient,
  geometric,
  mosaic,
};

/** The pack a seed belongs to. */
export function packFor(seed: number): Pack {
  return PACKS[(seed >>> 0) % PACKS.length]!;
}

function assertSize(width: number, height: number): void {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new RangeError(`Picture size must be whole, positive numbers, got ${width}×${height}`);
  }
}

/**
 * The RGBA pixels of the picture for `seed`, row by row, four bytes per pixel. Pure: no DOM,
 * so the same seed gives the same bytes in every run.
 */
export function renderPixels(seed: number, width: number, height: number): Uint8ClampedArray {
  assertSize(width, height);
  const s = seed >>> 0;
  const scene = SCENES[packFor(s)]({ seed: s, width, height, rand: createRng(s) });
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = scene(x, y);
      const i = (y * width + x) * 4;
      pixels[i] = r;
      pixels[i + 1] = g;
      pixels[i + 2] = b;
      pixels[i + 3] = 255;
    }
  }
  return pixels;
}

/** Draw the picture for `seed` to a new canvas of the given size. */
export function generateImage(seed: number, width: number, height: number): HTMLCanvasElement {
  const pixels = renderPixels(seed, width, height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas is not available");
  const image = ctx.createImageData(width, height);
  image.data.set(pixels);
  ctx.putImageData(image, 0, 0);
  return canvas;
}
