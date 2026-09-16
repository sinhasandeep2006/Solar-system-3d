import { CanvasTexture, SRGBColorSpace, type Texture } from "three";

/**
 * Procedural body textures, drawn into a 2D canvas at module level.
 *
 * No image files: NASA's surface maps are lovely but they are tens of
 * megabytes, they need licence attribution, and they would have to be fetched
 * at runtime. These are generated from each body's own colour, so they cost
 * nothing to ship and cannot 404. They are impressionistic, not photographic —
 * banding for the gas giants, mottling and polar caps for the rocky ones.
 *
 * ponytail: a canvas and two loops. If you ever want real imagery, swap this
 * one function for a useTexture call and nothing else changes.
 */

const W = 512;
const H = 256;

/** Deterministic noise, so a body looks the same on every reload. */
function makeRandom(seedText: string) {
  let s = 0;
  for (let i = 0; i < seedText.length; i++) s = (s * 31 + seedText.charCodeAt(i)) >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function parseHex(hex: string) {
  const n = parseInt(hex.replace("#", ""), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

const clamp255 = (n: number) => (n < 0 ? 0 : n > 255 ? 255 : n);

const cache = new Map<string, Texture | null>();

export function bodyTexture(hex: string, type: string, name: string): Texture | null {
  // Canvas does not exist while Next prerenders on the server.
  if (typeof document === "undefined") return null;

  const key = `${name}|${hex}|${type}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    cache.set(key, null);
    return null;
  }

  const base = parseHex(hex);
  const rand = makeRandom(name);
  const banded = type === "Gas giant" || type === "Ice giant";

  const image = ctx.createImageData(W, H);
  const px = image.data;

  // A handful of horizontal bands for the giants; each gets its own tint and
  // width, which is what reads as "atmosphere" rather than "striped ball".
  const bands = banded
    ? Array.from({ length: 11 }, () => ({ width: 0.5 + rand() * 1.5, shift: (rand() - 0.5) * 46 }))
    : [];
  const bandTotal = bands.reduce((sum, b) => sum + b.width, 0);

  for (let y = 0; y < H; y++) {
    const v = y / (H - 1);

    let tint = 0;
    if (banded) {
      let acc = 0;
      let idx = 0;
      for (let i = 0; i < bands.length; i++) {
        acc += bands[i].width / bandTotal;
        if (v <= acc) {
          idx = i;
          break;
        }
        idx = i;
      }
      // Soften the seam between neighbouring bands.
      const next = bands[Math.min(idx + 1, bands.length - 1)];
      tint = bands[idx].shift * 0.75 + next.shift * 0.25;
    }

    // Poles are darker everywhere, and icy on the rocky worlds.
    const polar = Math.pow(Math.abs(v - 0.5) * 2, 3);

    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      // Cheap value noise: a couple of octaves of per-pixel jitter, smoothed
      // horizontally by sampling a sine of the longitude.
      const lon = (x / W) * Math.PI * 2;
      const swirl = banded
        ? Math.sin(lon * 3 + y * 0.12) * 6 + Math.sin(lon * 7 - y * 0.05) * 3
        : Math.sin(lon * 5 + y * 0.3) * 4;
      const grain = (rand() - 0.5) * (banded ? 10 : 34);

      const shade = tint + swirl + grain - polar * 26;
      const ice = !banded ? polar * 52 : 0;

      px[i] = clamp255(base.r + shade + ice);
      px[i + 1] = clamp255(base.g + shade + ice);
      px[i + 2] = clamp255(base.b + shade + ice);
      px[i + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  cache.set(key, texture);
  return texture;
}
