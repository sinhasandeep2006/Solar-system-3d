import type { Vector3 } from "three";

/**
 * Classical two-body Keplerian orbits.
 *
 * Positions come back in whatever unit `Elements.a` is given in: |r| lands
 * between a(1-e) and a(1+e). The caller then applies one scene multiplier,
 * which is what lets Compressed and True Scale share a single exact orbit
 * shape — only the multiplier changes, never the geometry.
 *
 * Reference frame is the J2000 ecliptic. Three.js is Y-up, so ecliptic
 * (x, y, z) maps to scene (x, z, -y), which preserves handedness: a prograde
 * orbit still runs counter-clockwise viewed from scene +Y.
 */

export type Elements = {
  /** Semi-major axis, in whatever unit the caller scales by. */
  a: number;
  /** Eccentricity. 0 = circle, <1 = ellipse. */
  e: number;
  /** Inclination to the reference plane, degrees. */
  iDeg: number;
  /** Longitude of the ascending node, capital omega, degrees. */
  nodeDeg: number;
  /** Argument of periapsis, lower-case omega, degrees. */
  periDeg: number;
  /** Mean anomaly at epoch, degrees. */
  m0Deg: number;
};

export const DEG = Math.PI / 180;
const TAU = Math.PI * 2;

/** Wrap to [0, 2pi). Newton converges fastest near the principal value. */
export const wrapAngle = (x: number) => ((x % TAU) + TAU) % TAU;

/**
 * Solve Kepler's equation M = E - e*sin(E) for the eccentric anomaly E.
 *
 * Newton-Raphson. There is no closed form — this is the actual reason orbital
 * mechanics needs an iterative solver, and why a "pretend it is a circle"
 * shortcut gets the *timing* wrong even when the shape looks right: a body
 * near periapsis moves much faster than one near apoapsis.
 *
 * Converges to ~1e-12 in well under 12 steps for every eccentricity here
 * (the worst is Nereid at e=0.75). Starting at pi rather than M keeps the
 * high-eccentricity cases from overshooting on the first step.
 */
export function eccentricAnomaly(meanAnomaly: number, e: number): number {
  const m = wrapAngle(meanAnomaly);
  if (e === 0) return m;
  let E = e < 0.8 ? m : Math.PI;
  for (let i = 0; i < 12; i++) {
    const step = (E - e * Math.sin(E) - m) / (1 - e * Math.cos(E));
    E -= step;
    if (Math.abs(step) < 1e-12) break;
  }
  return E;
}

/** True anomaly: the actual angle from periapsis, as opposed to the mean one. */
export function trueAnomaly(E: number, e: number): number {
  return 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
}

/** Distance from the focus as a FRACTION of a: r/a = 1 - e*cos(E). */
export const radiusAt = (E: number, e: number) => 1 - e * Math.cos(E);

/**
 * Position at a given mean anomaly, in the same unit as `el.a`.
 * Writes into `out` and returns it, so the caller keeps one vector per body.
 */
export function positionAt(el: Elements, meanAnomaly: number, out: Vector3): Vector3 {
  const E = eccentricAnomaly(meanAnomaly, el.e);
  const nu = trueAnomaly(E, el.e);
  const r = el.a * radiusAt(E, el.e);

  // Argument of latitude: where the body sits measured from the ascending node.
  const u = nu + el.periDeg * DEG;
  const cu = Math.cos(u);
  const su = Math.sin(u);
  const cn = Math.cos(el.nodeDeg * DEG);
  const sn = Math.sin(el.nodeDeg * DEG);
  const ci = Math.cos(el.iDeg * DEG);
  const si = Math.sin(el.iDeg * DEG);

  const x = r * (cn * cu - sn * su * ci);
  const y = r * (sn * cu + cn * su * ci);
  const z = r * (su * si);

  return out.set(x, z, -y);
}

/**
 * The closed orbit as a flat [x,y,z,...] array in the same unit as `el.a`,
 * sampled at equal ECCENTRIC anomaly. Equal steps in E space the points evenly
 * around the ellipse; equal steps in mean anomaly would crowd them at apoapsis.
 */
export function orbitPath(el: Elements, segments = 256): Float32Array {
  const out = new Float32Array(segments * 3);
  const cn = Math.cos(el.nodeDeg * DEG);
  const sn = Math.sin(el.nodeDeg * DEG);
  const ci = Math.cos(el.iDeg * DEG);
  const si = Math.sin(el.iDeg * DEG);

  for (let k = 0; k < segments; k++) {
    const E = (k / segments) * TAU;
    const nu = trueAnomaly(E, el.e);
    const r = el.a * radiusAt(E, el.e);
    const u = nu + el.periDeg * DEG;
    const cu = Math.cos(u);
    const su = Math.sin(u);
    out[k * 3] = r * (cn * cu - sn * su * ci);
    out[k * 3 + 1] = r * (su * si);
    out[k * 3 + 2] = -r * (sn * cu + cn * su * ci);
  }
  return out;
}

/** Periapsis and apoapsis distance for an orbit. */
export const periapsis = (el: Elements) => el.a * (1 - el.e);
export const apoapsis = (el: Elements) => el.a * (1 + el.e);
