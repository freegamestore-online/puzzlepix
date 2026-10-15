import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/** The suite runs from web/, so the source stylesheet is read from there. */
const css = readFileSync(resolve("src/index.css"), "utf8");

/** The custom property names declared in the first block that matches `selector`. */
function variablesIn(selector: RegExp): string[] {
  const block = css.match(selector);
  if (!block) throw new Error(`no block matching ${selector}`);
  return [...block[1]!.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]!);
}

const LIGHT = /:root\s*\{([^}]*)\}/;
const DARK = /:root\[data-theme="dark"\]\s*\{([^}]*)\}/;

function valueOf(selector: RegExp, name: string): string {
  const block = css.match(selector)![1]!;
  return block.match(new RegExp(`${name}\\s*:\\s*([^;]+);`))![1]!.trim();
}

describe("light and dark themes", () => {
  it("has every colour in the light palette, and overrides the surface and text colours in dark", () => {
    const light = variablesIn(LIGHT);
    const dark = variablesIn(DARK);
    for (const name of ["--paper", "--ink", "--muted", "--line", "--panel", "--accent", "--success", "--error"]) {
      expect(light, name).toContain(name);
    }
    for (const name of ["--paper", "--ink", "--muted", "--line", "--panel"]) {
      expect(dark, name).toContain(name);
    }
  });

  it("changes the surface and text colours between the themes", () => {
    expect(valueOf(LIGHT, "--paper")).not.toBe(valueOf(DARK, "--paper"));
    expect(valueOf(LIGHT, "--ink")).not.toBe(valueOf(DARK, "--ink"));
  });

  it("switches on the SDK's data-theme attribute alone, so the theme toggle is always honoured", () => {
    expect(css).toContain(':root[data-theme="dark"]');
    expect(css).not.toMatch(/@media \(prefers-color-scheme/);
  });
});
