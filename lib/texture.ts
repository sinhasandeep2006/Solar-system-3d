import {
  CanvasTexture,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
} from "three";

/**
 * Procedural body surfaces, drawn into a 2D canvas at module level.
 *
 * No image files: NASA's surface maps are lovely but they are tens of
 * megabytes, they need licence attribution, and they would have to be fetched
 * at runtime. These are generated from each body's own colour, so they cost
 * nothing to ship and cannot 404. They are impressionistic, not photographic —
 * churned bands and storms for the giants, blotched terrain and craters for
 * the rocky ones, granulation for the sun.
 *
 * Each skin ships a matching BUMP map: the same canvas read as height rather
 * than colour, so the lighting picks out the noise instead of sliding over a
 * billiard ball. Reusing the one canvas is why the detail always lines up with
 * what you can see — a crater rim is bright because it is raised, not because
 * two separate generators happened to agree.
 *
 * ponytail: a canvas, a value-noise lattice and one pixel loop. If you ever
 * want real imagery, swap bodyTexture for a useTexture call and nothing else
 * changes.
 */

/**
 * Rocky and banded worlds; moons get half this, they are never large on screen.
 *
 * ponytail: every body generates its map on the main thread the first time it
 * mounts, and all ~48 of them mount in the same frame. At these sizes that is
 * a few hundred milliseconds once, on load. Double them and it is seconds —
 * move the loop to an OffscreenCanvas worker before you reach for more pixels.
 */
const BIG = { w: 512, h: 256 };
const SMALL = { w: 256, h: 128 };

/**
 * Bump strength per surface kind. This is a look knob, not a physical value —
 * three's bumpScale works off screen-space derivatives, so the right number
 * depends on the texture resolution above. Turn it up until the terminator
 * gets crunchy, then back off.
 */
const BUMP = { rocky: 0.9, banded: 0.25, star: 0 };

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

export type NoiseField = { g: Float32Array; w: number; h: number };

/** A wrapping lattice of random values in 0..1. */
export function noiseField(w: number, h: number, rand: () => number): NoiseField {
  const g = new Float32Array(w * h);
  for (let i = 0; i < g.length; i++) g[i] = rand();
  return { g, w, h };
}

/** Bilinear sample with a smoothstep fade. Both axes wrap. */
function sample(n: NoiseField, x: number, y: number) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const xa = ((x0 % n.w) + n.w) % n.w;
  const xb = (xa + 1) % n.w;
  const ya = ((y0 % n.h) + n.h) % n.h;
  const yb = (ya + 1) % n.h;
  const t = n.g[ya * n.w + xa] + (n.g[ya * n.w + xb] - n.g[ya * n.w + xa]) * sx;
  const b = n.g[yb * n.w + xa] + (n.g[yb * n.w + xb] - n.g[yb * n.w + xa]) * sx;
  return t + (b - t) * sy;
}

/**
 * Fractal sum of the lattice at u,v in 0..1, returned in 0..1.
 *
 * Every octave steps a WHOLE number of lattice cells across the map, which is
 * the one thing that keeps longitude 0 and longitude 360 identical. Without
 * that the seam shows up as a visible stripe down the back of every planet.
 */
export function fbm(n: NoiseField, u: number, v: number, octaves: number, freq = 1) {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let f = freq;
  for (let o = 0; o < octaves; o++) {
    sum += sample(n, u * n.w * f, v * n.h * f) * amp;
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
}

/**
 * Craters, drawn as canvas arcs after the pixel pass rather than tested per
 * pixel — 2D canvas does the rasterising, and the whole pass costs less than
 * one extra octave of noise.
 *
 * Each one is drawn three times so a crater straddling the seam appears on
 * both edges, and squashed in x by 1/cos(latitude) so it stays round once the
 * equirectangular map is wrapped onto a sphere.
 */
function drawCraters(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  rand: () => number,
  count: number,
) {
  for (let i = 0; i < count; i++) {
    const cx = rand() * w;
    const v = rand();
    const cy = v * h;
    // Small craters vastly outnumber large ones; cubing a uniform sample is
    // the cheapest way to get that distribution.
    const r = (0.004 + rand() ** 3 * 0.05) * w;
    // 1/cos blows up at the poles, where the map is stretched beyond use.
    const stretch = Math.min(1 / Math.max(Math.cos((v - 0.5) * Math.PI), 0.15), 6);
    const depth = 0.1 + rand() * 0.25;

    for (const shift of [-w, 0, w]) {
      ctx.save();
      ctx.translate(cx + shift, cy);
      ctx.scale(stretch, 1);
      // Dark floor, bright rim: the rim is the part that reads as relief once
      // the bump map picks it up.
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, `rgba(0,0,0,${depth})`);
      g.addColorStop(0.72, `rgba(0,0,0,${depth * 0.55})`);
      g.addColorStop(0.88, `rgba(255,255,255,${depth * 0.9})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

/** Oval storms for the giants — Jupiter's red spot and its lesser cousins. */
function drawStorms(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  rand: () => number,
  count: number,
) {
  for (let i = 0; i < count; i++) {
    const cx = rand() * w;
    // Storms sit in the belts, not on the poles.
    const cy = (0.22 + rand() * 0.56) * h;
    const rx = (0.02 + rand() ** 2 * 0.07) * w;
    const ry = rx * (0.3 + rand() * 0.25);
    const warm = rand() > 0.45;
    const a = 0.12 + rand() * 0.2;

    for (const shift of [-w, 0, w]) {
      ctx.save();
      ctx.translate(cx + shift, cy);
      ctx.rotate((rand() - 0.5) * 0.25);
      ctx.scale(1, ry / rx);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
      g.addColorStop(0, warm ? `rgba(190,90,55,${a})` : `rgba(255,248,235,${a})`);
      g.addColorStop(0.6, warm ? `rgba(170,95,60,${a * 0.5})` : `rgba(240,235,225,${a * 0.5})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, rx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

export type BodySkin = {
  /** Colour map. */
  map: Texture;
  /** The same canvas read as height. Null for the sun, which is unlit. */
  bump: Texture | null;
  bumpScale: number;
};

const cache = new Map<string, BodySkin | null>();

export function bodyTexture(hex: string, type: string, name: string): BodySkin | null {
  // Canvas does not exist while Next prerenders on the server.
  if (typeof document === "undefined") return null;

  const key = `${name}|${hex}|${type}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;

  const star = type === "Star";
  const banded = type === "Gas giant" || type === "Ice giant";
  const { w: W, h: H } = type === "Moon" ? SMALL : BIG;

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

  // Two independent fields: one for the terrain itself, one to push the
  // sampling coordinates around. Warping the lookup with a second field is
  // what turns smooth blobs into something that looks eroded or churned,
  // for the price of one extra fbm call.
  const terrain = noiseField(64, 32, rand);
  const warp = noiseField(32, 16, rand);

  // A handful of horizontal bands for the giants; each gets its own tint and
  // width, which is what reads as "atmosphere" rather than "striped ball".
  const bands = banded
    ? Array.from({ length: 13 }, () => ({ width: 0.5 + rand() * 1.5, shift: (rand() - 0.5) * 50 }))
    : [];
  const bandTotal = bands.reduce((sum, b) => sum + b.width, 0);

  const image = ctx.createImageData(W, H);
  const px = image.data;

  for (let y = 0; y < H; y++) {
    const v = y / (H - 1);
    // Poles are darker everywhere, and icy on the rocky worlds.
    const polar = Math.pow(Math.abs(v - 0.5) * 2, 3);

    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const u = x / W;

      // Domain warp. Bands get shoved sideways far more than up and down,
      // because that is what a zonal wind does to them.
      const wu = (fbm(warp, u, v, 2) - 0.5) * (banded ? 0.14 : 0.06);
      const wv = (fbm(warp, u + 0.37, v + 0.21, 2) - 0.5) * (banded ? 0.012 : 0.06);

      let shade: number;
      let ice = 0;

      if (star) {
        // Granulation: small convection cells, plus a slow large-scale drift
        // so the whole disc is not uniformly busy.
        const cells = fbm(terrain, u + wu, v + wv, 5, 6);
        const broad = fbm(terrain, u * 0.5, v * 0.5, 2);
        shade = (cells - 0.5) * 46 + (broad - 0.5) * 18;
      } else if (banded) {
        // Which band this latitude falls in, after the warp.
        const bv = Math.min(Math.max(v + wv, 0), 1);
        let acc = 0;
        let idx = bands.length - 1;
        for (let b = 0; b < bands.length; b++) {
          acc += bands[b].width / bandTotal;
          if (bv <= acc) {
            idx = b;
            break;
          }
        }
        // Soften the seam between neighbouring bands.
        const next = bands[Math.min(idx + 1, bands.length - 1)];
        const tint = bands[idx].shift * 0.75 + next.shift * 0.25;
        // Fine turbulence along the flow: stretched hard in longitude, which
        // is why it reads as wind rather than as fog.
        const flow = fbm(terrain, u + wu, v * 3 + wv, 4, 2) - 0.5;
        shade = tint + flow * 26 - polar * 20;
      } else {
        // Continents: two scales of blotch, the finer one ridged (folding the
        // noise about its midpoint) so the terrain gets edges instead of
        // being all soft hills.
        const broad = fbm(terrain, u + wu, v + wv, 3) - 0.5;
        const fine = 1 - Math.abs(fbm(terrain, u + wu, v + wv, 5, 4) * 2 - 1);
        shade = broad * 62 + (fine - 0.5) * 26 - polar * 30;
        ice = polar * 58;
      }

      px[i] = clamp255(base.r + shade + ice);
      px[i + 1] = clamp255(base.g + shade + ice);
      px[i + 2] = clamp255(base.b + shade + ice);
      px[i + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);

  if (banded) drawStorms(ctx, W, H, rand, 7);
  else if (!star) drawCraters(ctx, W, H, rand, Math.round(W / 4));

  const map = new CanvasTexture(canvas);
  map.colorSpace = SRGBColorSpace;
  map.anisotropy = 8;
  map.wrapS = RepeatWrapping;

  // Same pixels, read as height. Separate Texture because the colour map is
  // decoded from sRGB and a height map must not be.
  let bump: Texture | null = null;
  if (!star) {
    bump = new CanvasTexture(canvas);
    bump.colorSpace = NoColorSpace;
    bump.anisotropy = 4;
    bump.wrapS = RepeatWrapping;
  }

  const skin: BodySkin = { map, bump, bumpScale: banded ? BUMP.banded : BUMP.rocky };
  cache.set(key, skin);
  return skin;
}

/**
 * Fallback strip for the ring systems with no published map — Jupiter's,
 * Uranus', Neptune's.
 *
 * Same layout as the real Saturn strip: a wide, short image whose x axis runs
 * from the inner edge of the ring system to the outer, so Rings.tsx can map
 * both with one set of radial UVs. White with a varying alpha, so the band's
 * own colour and opacity still tint it.
 */
let ringCache: Texture | null | undefined;

export function ringTexture(): Texture | null {
  if (ringCache !== undefined) return ringCache;
  if (typeof document === "undefined") return null;

  const W = 1024;
  const H = 4;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    ringCache = null;
    return null;
  }

  const profile = noiseField(48, 1, makeRandom("rings"));
  const image = ctx.createImageData(W, H);
  const px = image.data;

  for (let x = 0; x < W; x++) {
    const t = x / (W - 1);
    // Two scales: gaps you can pick out, plus ringlet-level chatter.
    const broad = fbm(profile, t, 0, 3);
    const fine = fbm(profile, t, 0, 3, 9);
    const a = Math.round(Math.max(0, Math.min(1, broad * 0.8 + fine * 0.5 - 0.22)) * 255);
    for (let y = 0; y < H; y++) {
      const i = (y * W + x) * 4;
      px[i] = 255;
      px[i + 1] = 255;
      px[i + 2] = 255;
      px[i + 3] = a;
    }
  }

  ctx.putImageData(image, 0, 0);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  ringCache = texture;
  return texture;
}
