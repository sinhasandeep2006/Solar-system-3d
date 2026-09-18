import { describe, expect, it } from "vitest";
import { bodyTexture, fbm, noiseField } from "./texture";

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

describe("surface noise", () => {
  const field = noiseField(64, 32, seeded(1));

  it("closes the seam at longitude 0/360", () => {
    // The whole point of stepping whole lattice cells per octave. If this
    // fails, every body grows a visible stripe down its back.
    for (const v of [0, 0.17, 0.5, 0.83, 1]) {
      expect(fbm(field, 1, v, 5)).toBe(fbm(field, 0, v, 5));
      expect(fbm(field, 1, v, 5, 4)).toBe(fbm(field, 0, v, 5, 4));
    }
  });

  it("stays inside 0..1 so the colour offsets are bounded", () => {
    for (let i = 0; i < 400; i++) {
      const n = fbm(field, (i * 7919) % 1000 / 1000, (i * 104729) % 997 / 997, 5);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(1);
    }
  });

  it("is deterministic, so a planet looks the same on every reload", () => {
    const again = noiseField(64, 32, seeded(1));
    expect(fbm(again, 0.42, 0.61, 5)).toBe(fbm(field, 0.42, 0.61, 5));
  });

  it("varies: a constant field would be a flat colour", () => {
    const a = fbm(field, 0.1, 0.2, 5);
    const b = fbm(field, 0.7, 0.8, 5);
    expect(Math.abs(a - b)).toBeGreaterThan(0.01);
  });
});

describe("bodyTexture", () => {
  it("returns null without a document, so Next can prerender the page", () => {
    expect(bodyTexture("#3f7fd6", "Terrestrial", "Earth")).toBeNull();
  });
});
