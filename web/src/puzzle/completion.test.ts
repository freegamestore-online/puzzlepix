import { describe, expect, it } from "vitest";
import { completionEffects } from "./completion";

describe("completionEffects", () => {
  it("shows nothing before the puzzle is solved", () => {
    expect(completionEffects(false, false)).toEqual({ picture: false, fadeIn: false, shimmer: false });
    expect(completionEffects(false, true)).toEqual({ picture: false, fadeIn: false, shimmer: false });
  });

  it("shows the picture with its fade and sheen when motion is allowed", () => {
    expect(completionEffects(true, false)).toEqual({ picture: true, fadeIn: true, shimmer: true });
  });

  it("reduced motion keeps the finished picture but suppresses the animations", () => {
    expect(completionEffects(true, true)).toEqual({ picture: true, fadeIn: false, shimmer: false });
  });
});
