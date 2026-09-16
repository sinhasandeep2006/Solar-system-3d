// Physical values from the NASA planetary fact sheets.
//
// ORBITAL ELEMENTS are the J2000 set from JPL's "Keplerian Elements for
// Approximate Positions of the Major Planets" (valid 1800-2050), quoted in
// JPL's own form: longitude of perihelion and mean longitude rather than
// argument of perihelion and mean anomaly. elementsOf() converts.
// The five dwarf planets come from the JPL Small-Body Database; their epochs
// differ slightly from J2000, so their phase at t=0 is good to a few degrees
// rather than exact. Every shape parameter (a, e, i) is exact.
//
// diameterKm  = equatorial diameter
// au          = semi-major axis in astronomical units
// orbitYears  = sidereal orbital period in Earth years
// dayDays     = sidereal rotation period in Earth days (magnitude only)
// retrograde  = spins opposite to its orbital direction
// axialTilt   = obliquity to orbit, degrees
// moonCount   = total CONFIRMED natural satellites. Volatile: Saturn went
//               146 -> 274 in March 2025 and Jupiter gains a few most years.
//               Only the major ones are rendered (see moons.ts).
import type { Elements } from "./kepler";

/**
 * JPL's six elements at J2000 plus their linear rates per Julian century.
 * The rates are what make the orbits PRECESS: the perihelion of Mercury
 * creeps round at 0.16 deg/century, the nodes drift, eccentricities breathe.
 * `meanLonRate` also carries the orbital motion itself (Earth: 35999.37
 * deg/century, i.e. one lap a year), so the body's position and the slow
 * turning of its orbit come from one consistent source.
 *
 * Accurate over 1800-2050, which is the range JPL publishes this set for.
 */
export type OrbitElements = {
  /** Semi-major axis, AU. */
  a: number;
  /** Eccentricity. */
  e: number;
  /** Inclination to the ecliptic, degrees. */
  iDeg: number;
  /** Longitude of the ascending node, degrees. */
  nodeDeg: number;
  /** Longitude of perihelion (node + argument of perihelion), degrees. */
  periLonDeg: number;
  /** Mean longitude at J2000, degrees. */
  meanLonDeg: number;
  /** Per Julian century. */
  aRate: number;
  eRate: number;
  iRate: number;
  nodeRate: number;
  periLonRate: number;
  meanLonRate: number;
};

export type BodyKind = "planet" | "dwarf";

export type PlanetData = {
  name: string;
  kind: BodyKind;
  type: string;
  color: string;
  diameterKm: number;
  orbit: OrbitElements;
  orbitYears: number;
  dayDays: number;
  retrograde: boolean;
  axialTilt: number;
  massKg: number;
  gravity: number; // m/s^2 at the equator
  meanTempC: number;
  moonCount: number;
  // Real ring bands, inner->outer. Separate entries leave the real gaps
  // empty — most visibly Saturn's Cassini Division at 117,580-122,170 km.
  rings?: { color: string; bands: { innerKm: number; outerKm: number; opacity: number }[] };
};

export const AU_KM = 149_597_870.7;

const planet = (b: Omit<PlanetData, "kind">): PlanetData => ({ ...b, kind: "planet" });
const dwarf = (b: Omit<PlanetData, "kind">): PlanetData => ({ ...b, kind: "dwarf" });

export const PLANETS: PlanetData[] = [
  planet({ name: "Mercury", type: "Terrestrial", color: "#9a8f86", diameterKm: 4_879, orbit: { a: 0.38709927, e: 0.20563593, iDeg: 7.00497902, nodeDeg: 48.33076593, periLonDeg: 77.45779628, meanLonDeg: 252.2503235, aRate: 3.7e-07, eRate: 1.906e-05, iRate: -0.00594749, nodeRate: -0.12534081, periLonRate: 0.16047689, meanLonRate: 149472.67411175 }, orbitYears: 0.2408, dayDays: 58.646, retrograde: false, axialTilt: 0.034, massKg: 3.301e23, gravity: 3.7, meanTempC: 167, moonCount: 0 }),
  planet({ name: "Venus", type: "Terrestrial", color: "#e3c07b", diameterKm: 12_104, orbit: { a: 0.72333566, e: 0.00677672, iDeg: 3.39467605, nodeDeg: 76.67984255, periLonDeg: 131.60246718, meanLonDeg: 181.9790995, aRate: 3.9e-06, eRate: -4.107e-05, iRate: -0.0007889, nodeRate: -0.27769418, periLonRate: 0.00268329, meanLonRate: 58517.81538729 }, orbitYears: 0.6152, dayDays: 243.018, retrograde: true, axialTilt: 177.36, massKg: 4.867e24, gravity: 8.87, meanTempC: 464, moonCount: 0 }),
  planet({ name: "Earth", type: "Terrestrial", color: "#3f7fd6", diameterKm: 12_756, orbit: { a: 1.00000261, e: 0.01671123, iDeg: -1.531e-05, nodeDeg: 0.0, periLonDeg: 102.93768193, meanLonDeg: 100.46457166, aRate: 5.62e-06, eRate: -4.392e-05, iRate: -0.01294668, nodeRate: 0.0, periLonRate: 0.32327364, meanLonRate: 35999.37244981 }, orbitYears: 1.0, dayDays: 0.99727, retrograde: false, axialTilt: 23.44, massKg: 5.972e24, gravity: 9.81, meanTempC: 15, moonCount: 1 }),
  planet({ name: "Mars", type: "Terrestrial", color: "#c1502e", diameterKm: 6_792, orbit: { a: 1.52371034, e: 0.0933941, iDeg: 1.84969142, nodeDeg: 49.55953891, periLonDeg: -23.94362959, meanLonDeg: -4.55343205, aRate: 1.847e-05, eRate: 7.882e-05, iRate: -0.00813131, nodeRate: -0.29257343, periLonRate: 0.44441088, meanLonRate: 19140.30268499 }, orbitYears: 1.8808, dayDays: 1.02596, retrograde: false, axialTilt: 25.19, massKg: 6.417e23, gravity: 3.71, meanTempC: -65, moonCount: 2 }),
  planet({
    name: "Jupiter", type: "Gas giant", color: "#d3a869", diameterKm: 142_984, orbit: { a: 5.202887, e: 0.04838624, iDeg: 1.30439695, nodeDeg: 100.47390909, periLonDeg: 14.72847983, meanLonDeg: 34.39644051, aRate: -0.00011607, eRate: -0.00013253, iRate: -0.00183714, nodeRate: 0.20469106, periLonRate: 0.21252668, meanLonRate: 3034.74612775 }, orbitYears: 11.862, dayDays: 0.41354, retrograde: false, axialTilt: 3.13, massKg: 1.898e27, gravity: 24.79, meanTempC: -110, moonCount: 95,
    rings: { color: "#8a7758", bands: [{ innerKm: 122_500, outerKm: 129_000, opacity: 0.13 }] },
  }),
  planet({
    name: "Saturn", type: "Gas giant", color: "#e0c791", diameterKm: 120_536, orbit: { a: 9.53667594, e: 0.05386179, iDeg: 2.48599187, nodeDeg: 113.66242448, periLonDeg: 92.59887831, meanLonDeg: 49.95424423, aRate: -0.0012506, eRate: -0.00050991, iRate: 0.00193609, nodeRate: -0.28867794, periLonRate: -0.41897216, meanLonRate: 1222.49362201 }, orbitYears: 29.457, dayDays: 0.44401, retrograde: false, axialTilt: 26.73, massKg: 5.683e26, gravity: 10.44, meanTempC: -140, moonCount: 274,
    rings: {
      color: "#cdb98f",
      bands: [
        { innerKm: 74_500, outerKm: 92_000, opacity: 0.22 }, // C ring
        { innerKm: 92_000, outerKm: 117_580, opacity: 0.8 }, // B ring
        { innerKm: 122_170, outerKm: 136_775, opacity: 0.5 }, // A ring
      ],
    },
  }),
  planet({
    name: "Uranus", type: "Ice giant", color: "#9ad4dd", diameterKm: 51_118, orbit: { a: 19.18916464, e: 0.04725744, iDeg: 0.77263783, nodeDeg: 74.01692503, periLonDeg: 170.9542763, meanLonDeg: 313.23810451, aRate: -0.00196176, eRate: -4.397e-05, iRate: -0.00242939, nodeRate: 0.04240589, periLonRate: 0.40805281, meanLonRate: 428.48202785 }, orbitYears: 84.011, dayDays: 0.71833, retrograde: true, axialTilt: 97.77, massKg: 8.681e25, gravity: 8.87, meanTempC: -195, moonCount: 28,
    rings: { color: "#7fa8b5", bands: [{ innerKm: 38_000, outerKm: 51_150, opacity: 0.25 }] },
  }),
  planet({
    name: "Neptune", type: "Ice giant", color: "#4a66d6", diameterKm: 49_528, orbit: { a: 30.06992276, e: 0.00859048, iDeg: 1.77004347, nodeDeg: 131.78422574, periLonDeg: 44.96476227, meanLonDeg: -55.12002969, aRate: 0.00026291, eRate: 5.105e-05, iRate: 0.00035372, nodeRate: -0.00508664, periLonRate: -0.32241464, meanLonRate: 218.45945325 }, orbitYears: 164.79, dayDays: 0.67125, retrograde: false, axialTilt: 28.32, massKg: 1.024e26, gravity: 11.15, meanTempC: -200, moonCount: 16,
    rings: { color: "#5d78c4", bands: [{ innerKm: 41_900, outerKm: 62_933, opacity: 0.18 }] },
  }),
];

export const DWARFS: PlanetData[] = [
  dwarf({ name: "Ceres", type: "Dwarf planet", color: "#9c9086", diameterKm: 946, orbit: { a: 2.7665, e: 0.07839, iDeg: 10.5878, nodeDeg: 80.3055, periLonDeg: 153.9032, meanLonDeg: 249.8923, aRate: 0, eRate: 0, iRate: 0, nodeRate: 0, periLonRate: 0, meanLonRate: 7826.086957 }, orbitYears: 4.6, dayDays: 0.378, retrograde: false, axialTilt: 4.0, massKg: 9.39e20, gravity: 0.27, meanTempC: -105, moonCount: 0 }),
  dwarf({ name: "Pluto", type: "Dwarf planet", color: "#c4a48a", diameterKm: 2_376, orbit: { a: 39.48211675, e: 0.2488273, iDeg: 17.14001206, nodeDeg: 110.30393684, periLonDeg: 224.06891629, meanLonDeg: 238.92903833, aRate: 0, eRate: 0, iRate: 0, nodeRate: 0, periLonRate: 0, meanLonRate: 145.196418 }, orbitYears: 247.94, dayDays: 6.3872, retrograde: true, axialTilt: 122.53, massKg: 1.303e22, gravity: 0.62, meanTempC: -225, moonCount: 5 }),
  dwarf({ name: "Haumea", type: "Dwarf planet", color: "#ddd5c8", diameterKm: 1_560, orbit: { a: 43.116, e: 0.19126, iDeg: 28.213, nodeDeg: 122.167, periLonDeg: 1.208, meanLonDeg: 219.413, aRate: 0, eRate: 0, iRate: 0, nodeRate: 0, periLonRate: 0, meanLonRate: 126.707025 }, orbitYears: 284.12, dayDays: 0.163, retrograde: false, axialTilt: 126.0, massKg: 4.01e21, gravity: 0.44, meanTempC: -241, moonCount: 2 }),
  dwarf({ name: "Makemake", type: "Dwarf planet", color: "#c98f6e", diameterKm: 1_430, orbit: { a: 45.43, e: 0.16126, iDeg: 28.9835, nodeDeg: 79.62, periLonDeg: 14.454, meanLonDeg: 179.968, aRate: 0, eRate: 0, iRate: 0, nodeRate: 0, periLonRate: 0, meanLonRate: 117.566376 }, orbitYears: 306.21, dayDays: 0.9511, retrograde: false, axialTilt: 0, massKg: 3.1e21, gravity: 0.5, meanTempC: -239, moonCount: 1 }),
  dwarf({ name: "Eris", type: "Dwarf planet", color: "#d8d8d2", diameterKm: 2_326, orbit: { a: 67.864, e: 0.43607, iDeg: 44.04, nodeDeg: 35.951, periLonDeg: 187.59, meanLonDeg: 33.579, aRate: 0, eRate: 0, iRate: 0, nodeRate: 0, periLonRate: 0, meanLonRate: 64.511505 }, orbitYears: 558.04, dayDays: 15.786, retrograde: false, axialTilt: 78.0, massKg: 1.639e22, gravity: 0.82, meanTempC: -243, moonCount: 1 }),
];

export const BODIES: PlanetData[] = [...PLANETS, ...DWARFS];

/**
 * Elements at a moment in time, `years` after J2000.
 *
 * JPL quotes longitude of perihelion and mean longitude; the Kepler solver
 * wants argument of periapsis and mean anomaly, and the difference is the
 * node. Every element is advanced by its own linear rate first, so the orbit
 * precesses as well as the body moving along it.
 */
export function elementsOf(b: PlanetData, years = 0): Elements {
  const o = b.orbit;
  const t = years / 100; // Julian centuries past J2000
  const node = o.nodeDeg + o.nodeRate * t;
  const periLon = o.periLonDeg + o.periLonRate * t;
  const meanLon = o.meanLonDeg + o.meanLonRate * t;
  return {
    a: o.a + o.aRate * t,
    e: o.e + o.eRate * t,
    iDeg: o.iDeg + o.iRate * t,
    nodeDeg: node,
    periDeg: periLon - node,
    m0Deg: meanLon - periLon,
  };
}

/** Closest and furthest the body ever gets from the sun, in AU. */
export const perihelionAu = (b: PlanetData, years = 0) => {
  const el = elementsOf(b, years);
  return el.a * (1 - el.e);
};
export const aphelionAu = (b: PlanetData, years = 0) => {
  const el = elementsOf(b, years);
  return el.a * (1 + el.e);
};
