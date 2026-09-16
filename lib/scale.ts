// Pure scale/speed math. No three.js, no React — unit tested in scale.test.ts.

// Compressed-mode constant: radius = C * sqrt(AU). Sized together with the
// moon coefficient below so the widest moon system still fits the tightest
// planet gap — which, once the orbits became eccentric, turned out to be
// Earth aphelion -> Mars perihelion, not Venus -> Earth as you would guess.
// Guarded by the "clear of any orbit it does not cross" test.
export const COMPRESSED_C = 12;
export const TRUE_SCALE = 40; // true-mode constant: radius = AU * scaleFactor
export const SUN_RADIUS = 2.5;

export const EARTH_DIAMETER_KM = 12_756;
/** Seconds of wall clock for one Earth orbit at speed multiplier 1. */
export const EARTH_YEAR_SECONDS = 12;
/**
 * Seconds of wall clock for one Earth rotation at speed multiplier 1, when
 * spin runs on its own base. Deliberately NOT EARTH_YEAR_SECONDS/365.25 —
 * that would spin Earth 30x a second. Spins stay correct relative to each
 * other. Turn on True spin to lock them to the orbit instead, which is
 * physically exact and, at 366 turns per lap, visibly a blur.
 */
export const EARTH_DAY_SECONDS = 3;

/**
 * Rotations per orbit in the INERTIAL frame, the physically real ratio.
 * Earth comes out at 366.25, not 365.25: a year holds one more sidereal
 * rotation than it holds solar days, because one turn is used up going round
 * the sun. dayDays is already the sidereal period, so the arithmetic is direct.
 */
export const rotationsPerOrbit = (orbitYears: number, dayDays: number) =>
  (orbitYears * 365.25) / dayDays;

const TAU = Math.PI * 2;

export const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

/** Compressed: preserves ordering, squashes the outer-planet gaps into frame. */
export const compressedRadius = (au: number) => COMPRESSED_C * Math.sqrt(au);

/** True: linearly proportional to real distance. Outer planets go far away. */
export const trueRadius = (au: number) => au * TRUE_SCALE;

/**
 * Draw distance for an INSTANTANEOUS heliocentric distance, in AU.
 *
 * One global, monotonic radial map applied to every body alike. That word
 * "global" is the point, and it is a deliberate change from the earlier
 * per-orbit uniform scaling.
 *
 * You cannot have all three of these at once:
 *   (a) compress distances non-linearly so the outer system fits on screen,
 *   (b) draw every orbit as an exact ellipse,
 *   (c) keep bodies faithful in position RELATIVE to each other.
 *
 * Scaling each orbit by its own factor bought (a) and (b), and the price was
 * (c): because the Eris factor is far smaller than the Uranus one, a 38.3 AU
 * perihelion got drawn down beside a 20.1 AU aphelion, and the famous dip of
 * Pluto inside Neptune vanished. Warping the radius itself buys (a) and (c)
 * instead: two orbits cross on screen if and only if they cross in reality.
 * Ellipses come out slightly rounded in Compressed mode, and exactly right in
 * True Scale, where the map is linear and all three hold at once.
 */
export function drawRadius(rAu: number, blend: number): number {
  const b = clamp01(blend);
  return compressedRadius(rAu) * (1 - b) + trueRadius(rAu) * b;
}

/** Drawn radius of a CIRCLE of radius `au`. */
export const orbitRadius = (au: number, blend: number) => drawRadius(au, blend);

/**
 * Scene units per km when drawing bodies at their TRUE relative sizes. Set so
 * Jupiter lands at 1.6 units and everything else follows from real diameters.
 * The sun is excluded: at this factor it is 15.6 units across, which in
 * Compressed mode swallows the whole orbit of Mercury.
 */
export const TRUE_SIZE_PER_KM = 1.6 / 142_984;

/**
 * Drawn radius. Real diameters span 29x (Mercury -> Jupiter), so a raw ratio
 * leaves the rocky planets nearly invisible. ^0.4 keeps the ordering and the
 * sense of "Jupiter is the big one" while staying on screen. Pass trueSizes
 * to drop the curve and use the real ratios instead.
 */
export const displayRadius = (diameterKm: number, trueSizes = false) =>
  trueSizes
    ? diameterKm * TRUE_SIZE_PER_KM
    : 0.35 * Math.pow(diameterKm / EARTH_DIAMETER_KM, 0.4);

/** Radians/second of orbit. Derived from the real period, never hardcoded. */
export const orbitAngularSpeed = (orbitYears: number) =>
  TAU / (EARTH_YEAR_SECONDS * orbitYears);

/**
 * Radians/second of spin. Negative for retrograde rotators.
 * Given orbitYears, the rate becomes the orbital mean motion times the real
 * rotations per orbit, so Earth turns 366.25 times per lap.
 */
export function spinAngularSpeed(
  dayDays: number,
  retrograde: boolean,
  orbitYears?: number,
): number {
  const sign = retrograde ? -1 : 1;
  if (orbitYears === undefined) return (TAU / (EARTH_DAY_SECONDS * dayDays)) * sign;
  return orbitAngularSpeed(orbitYears) * rotationsPerOrbit(orbitYears, dayDays) * sign;
}

/** Starting angle per planet so they don't all launch in a straight line. */
export const phaseFor = (index: number) => index * 2.39996; // golden angle

// ---- Moons ------------------------------------------------------------
// Moon orbits CANNOT use the planet scale. The Moon sits 0.00257 AU from
// Earth: at TRUE_SCALE that is 0.10 units, well inside Earth's own drawn
// radius of 0.35. So moons get their own log-compressed scale, expressed in
// parent radii, which keeps real ordering (Io inside Europa inside Ganymede
// inside Callisto) while staying visible and clear of the neighbouring orbits.

/** Closest a moon may be drawn to its parent centre, in parent radii. */
export const MOON_CLEARANCE = 1.6;

/** Where a single real distance from the parent lands, in scene units. */
export const moonRadiusAt = (
  parentSceneRadius: number,
  distanceKm: number,
  parentDiameterKm: number,
) =>
  parentSceneRadius *
  (MOON_CLEARANCE + 0.8 * Math.log10(1 + distanceKm / (parentDiameterKm / 2)));

/** Drawn semi-major axis of a moon orbit, ignoring its eccentricity. */
export const moonOrbitRadius = (
  parentSceneRadius: number,
  axisKm: number,
  parentDiameterKm: number,
) => moonRadiusAt(parentSceneRadius, axisKm, parentDiameterKm);

/**
 * Drawn shape of a moon orbit, keeping the REAL eccentricity.
 *
 * The axis is log-compressed, then, only if that would push periapsis inside
 * the parent, the whole orbit is moved outward until it clears. Compressing
 * the two ends separately would also clear the planet, but it flattens the
 * eccentricity, and an e of 0.75 is worth seeing. Moving the orbit out keeps
 * every ellipse exactly the right shape and costs only the drawn distance,
 * which was never to scale in the first place.
 *
 * Nereid is the only one of the 35 that needs the nudge.
 */
export function moonOrbitShape(
  parentSceneRadius: number,
  axisKm: number,
  e: number,
  parentDiameterKm: number,
): { a: number; e: number } {
  const a = moonRadiusAt(parentSceneRadius, axisKm, parentDiameterKm);
  const clearing = (parentSceneRadius * MOON_CLEARANCE) / (1 - e);
  return { a: Math.max(a, clearing), e };
}

/**
 * Drawn moon radius. ^0.3 of the real diameter ratio, clamped so Ganymede
 * does not swallow Jupiter and Phobos does not vanish entirely.
 * ponytail: cosmetic curve like displayRadius, tune the exponent freely.
 */
export function moonDisplayRadius(
  parentSceneRadius: number,
  diameterKm: number,
  parentDiameterKm: number,
  trueSizes = false,
) {
  if (trueSizes) return diameterKm * TRUE_SIZE_PER_KM;
  const ratio = Math.pow(diameterKm / parentDiameterKm, 0.3);
  return parentSceneRadius * Math.min(0.4, Math.max(0.1, 0.5 * ratio));
}

// ---- Rings ------------------------------------------------------------
/** Ring edges are real multiples of the planet radius, so these stay honest. */
export const ringRadius = (parentSceneRadius: number, edgeKm: number, parentDiameterKm: number) =>
  parentSceneRadius * (edgeKm / (parentDiameterKm / 2));

// ---- Belts ------------------------------------------------------------
/** Kepler's third law: a body at `au` takes au^1.5 Earth years to go round. */
export const keplerYears = (au: number) => Math.pow(au, 1.5);

// Belt bounds and the observed spread of eccentricity/inclination within them.
// Main-belt asteroids average e~0.15 and i~10 deg; classical Kuiper Belt
// objects are colder, with lower e but a wide inclination spread.
export const ASTEROID_BELT = { minAu: 2.06, maxAu: 3.27, count: 1400, spreadE: 0.22, spreadI: 18 };
export const KUIPER_BELT = { minAu: 30, maxAu: 50, count: 1100, spreadE: 0.14, spreadI: 26 };

// ---- Radial warp helpers ----------------------------------------------
// Positions arrive from the Kepler solver in AU. These map them into scene
// units through drawRadius, which is a pure radial map: direction is never
// touched, only distance from the sun.

/** Warp one AU-space vector into scene units, in place. */
export function warpVector(v: { x: number; y: number; z: number }, blend: number) {
  const r = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  if (r === 0) return v;
  const k = drawRadius(r, blend) / r;
  v.x *= k;
  v.y *= k;
  v.z *= k;
  return v;
}

/** Warp a whole [x,y,z,...] orbit path from AU into scene units. */
export function warpPath(auPath: Float32Array, out: Float32Array, blend: number) {
  for (let i = 0; i < auPath.length; i += 3) {
    const x = auPath[i];
    const y = auPath[i + 1];
    const z = auPath[i + 2];
    const r = Math.sqrt(x * x + y * y + z * z);
    const k = r === 0 ? 0 : drawRadius(r, blend) / r;
    out[i] = x * k;
    out[i + 1] = y * k;
    out[i + 2] = z * k;
  }
}

// ---- Barycentre -------------------------------------------------------
/**
 * How far the primary sits from the shared barycentre, as a fraction of the
 * separation. A planet does not sit still while a moon goes round it: both
 * circle their common centre of mass. For Pluto and Charon that centre is
 * outside Pluto's surface, which is why Pluto visibly wobbles.
 */
export const barycentreFraction = (primaryMassKg: number, secondaryMassKg: number) =>
  secondaryMassKg / (primaryMassKg + secondaryMassKg);
