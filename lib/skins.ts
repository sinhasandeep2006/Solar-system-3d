"use client";

import { useEffect, useState } from "react";
import { RepeatWrapping, SRGBColorSpace, TextureLoader, type Texture } from "three";

/**
 * Real surface maps, from public/textures (see the NOTICE in there, and
 * scripts/fetch-textures.mjs for where each one comes from).
 *
 * Loaded imperatively rather than through Suspense: 11MB of JPEG behind a
 * <Suspense> boundary means the whole scene is a blank screen until the last
 * one lands. This way each body swaps its map in the moment its own file is
 * ready, and everything else keeps running.
 *
 * Anything not listed here falls back to the procedural map in texture.ts —
 * which is every moon except our own, because nobody publishes a global
 * mosaic of Enceladus.
 */
const MAPPED = new Set([
  "Sun",
  "Mercury",
  "Venus",
  "Earth",
  "Mars",
  "Jupiter",
  "Saturn",
  "Uranus",
  "Neptune",
  "Pluto",
  "Ceres",
  "Eris",
  "Haumea",
  "Makemake",
  "Moon",
]);

export function realMapUrl(name: string): string | null {
  return MAPPED.has(name) ? `/textures/${name.toLowerCase()}.jpg` : null;
}

export const EARTH_NIGHT = "/textures/earth-night.jpg";
export const EARTH_CLOUDS = "/textures/earth-clouds.jpg";
export const SATURN_RINGS = "/textures/saturn-rings.png";

/**
 * Bump strength for the real maps. There is no published height map for most
 * of these, so the colour map doubles as one: a crater floor is dark, a rim is
 * bright, and that is close enough to relief that the terminator stops looking
 * like a straight cut.
 *
 * A look knob, not a physical value. three's bumpScale works off screen-space
 * derivatives, so these are tied to the 2048px maps — halve them if you ever
 * drop to 1k.
 */
export const REAL_BUMP = { rocky: 0.32, banded: 0.06 };

const loader = new TextureLoader();
const cache = new Map<string, Promise<Texture | null>>();

function load(url: string) {
  let pending = cache.get(url);
  if (!pending) {
    pending = loader.loadAsync(url).then(
      (t) => {
        t.colorSpace = SRGBColorSpace;
        t.anisotropy = 8;
        // Longitude wraps; latitude must not, or the north pole bleeds into
        // the south.
        t.wrapS = RepeatWrapping;
        return t;
      },
      // A missing file is not worth crashing the scene over — the caller
      // falls back to its procedural map.
      () => null,
    );
    cache.set(url, pending);
  }
  return pending;
}

/** Null until the file has loaded, and null forever if it never does. */
export function useRealMap(url: string | null): Texture | null {
  const [texture, setTexture] = useState<Texture | null>(null);

  useEffect(() => {
    if (!url) return;
    let live = true;
    load(url).then((t) => {
      if (live) setTexture(t);
    });
    return () => {
      live = false;
    };
  }, [url]);

  // Gated on the url rather than cleared in the effect: a body's url never
  // changes in practice, and setting state in an effect body to handle a case
  // that cannot happen is how you get cascading renders.
  return url ? texture : null;
}
