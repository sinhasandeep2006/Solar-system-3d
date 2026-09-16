import { Vector3 } from "three";
import { DEG, positionAt } from "./kepler";
import { elementsOf, PLANETS, type PlanetData } from "./planets";

/**
 * Where a planet APPEARS to be, seen from Earth.
 *
 * This is the payoff for solving Kepler properly. Every few months an outer
 * planet stops, tracks backwards across the sky for weeks, then resumes — the
 * retrograde loop. It is not the planet reversing: it is Earth, on a shorter
 * and faster orbit, overtaking on the inside. That loop is the observation
 * geocentric models had to keep bolting epicycles on to explain, and getting
 * it out of nothing but two heliocentric ellipses is the whole argument for
 * doing the orbital mechanics for real.
 */

export type SkyPoint = {
  /** Simulated years since J2000. */
  years: number;
  /** Ecliptic longitude as seen from Earth, degrees, 0-360. */
  lonDeg: number;
  /** Ecliptic latitude as seen from Earth, degrees. */
  latDeg: number;
  /** Distance from Earth, AU. */
  distanceAu: number;
  /**
   * Angle Sun-Earth-body, degrees. 180 is opposition, where an outer planet
   * is closest, brightest and up all night; 0 is conjunction. Inner planets
   * never get far from the sun, which is why you only see them near dusk
   * or dawn.
   */
  elongationDeg: number;
  /** True while the apparent longitude is decreasing: the retrograde arc. */
  retrograde: boolean;
};

const earthData = () => PLANETS.find((p) => p.name === "Earth")!;

/** Heliocentric position in AU at a moment, in the scene's axis convention. */
function helio(body: PlanetData, years: number, out: Vector3) {
  const el = elementsOf(body, years);
  return positionAt(el, el.m0Deg * DEG, out);
}

/**
 * The apparent path of `body` across the sky over a span of time.
 * Samples are evenly spaced; 2-3 per degree of motion is plenty.
 */
export function geocentricTrack(
  body: PlanetData,
  fromYears: number,
  toYears: number,
  samples = 240,
): SkyPoint[] {
  const target = new Vector3();
  const earth = new Vector3();
  const track: SkyPoint[] = [];

  for (let i = 0; i < samples; i++) {
    const years = fromYears + ((toYears - fromYears) * i) / (samples - 1);
    helio(body, years, target);
    helio(earthData(), years, earth);
    // Geocentric = heliocentric target minus heliocentric Earth.
    target.sub(earth);

    // Scene axes are (x, z, -y) of the ecliptic frame; undo that to read
    // longitude and latitude the conventional way.
    const x = target.x;
    const y = -target.z;
    const z = target.y;
    const distanceAu = target.length();
    const lonDeg = (((Math.atan2(y, x) / DEG) % 360) + 360) % 360;
    const latDeg = Math.asin(z / distanceAu) / DEG;
    // Elongation: the angle at Earth between the sun and the body. `earth` is
    // Earth seen from the sun, so the sun seen from Earth is its negation.
    const elongationDeg = target.angleTo(earth.negate()) / DEG;

    track.push({ years, lonDeg, latDeg, distanceAu, elongationDeg, retrograde: false });
  }

  // Mark the arcs where apparent longitude is decreasing. Compared on the
  // shortest way round, so wrapping through 360 is not read as a reversal.
  for (let i = 1; i < track.length; i++) {
    track[i].retrograde = shortestDelta(track[i - 1].lonDeg, track[i].lonDeg) < 0;
  }
  if (track.length > 1) track[0].retrograde = track[1].retrograde;

  return track;
}

/** Signed difference between two longitudes, in (-180, 180]. */
export function shortestDelta(fromDeg: number, toDeg: number) {
  let d = (toDeg - fromDeg) % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

/** Contiguous retrograde spans within a track, as [startIndex, endIndex]. */
export function retrogradeSpans(track: SkyPoint[]): [number, number][] {
  const spans: [number, number][] = [];
  let start = -1;
  for (let i = 0; i < track.length; i++) {
    if (track[i].retrograde && start === -1) start = i;
    if (!track[i].retrograde && start !== -1) {
      spans.push([start, i - 1]);
      start = -1;
    }
  }
  if (start !== -1) spans.push([start, track.length - 1]);
  // One or two stray samples is numerical noise, not a genuine reversal.
  return spans.filter(([a, b]) => b - a >= 2);
}

/** Synodic period: how often Earth laps the body, or is lapped by it. */
export function synodicYears(body: PlanetData) {
  const earthYears = earthData().orbitYears;
  return Math.abs(1 / (1 / earthYears - 1 / body.orbitYears));
}
