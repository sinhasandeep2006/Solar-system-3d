import type { Elements } from "./kepler";

/**
 * Periodic comets, from the JPL Small-Body Database.
 *
 * ACCURACY, stated plainly: the shape of these orbits (a, e, i, node, argument
 * of perihelion) is published and exact, and the perihelion passage dates are
 * observed fact. The mean anomaly at J2000 is DERIVED from the passage date
 * and the mean period rather than read from a published J2000 epoch, so a
 * comet's position here is good to weeks or months, not the arcseconds the
 * planets manage.
 *
 * That is also closer to the truth than it sounds. Comet orbits genuinely
 * change: Jupiter's pull swings Halley's period between about 74 and 79 years,
 * and Encke is measurably shoved by the jets coming off its own nucleus. A
 * single fixed element set is an approximation for any comet, at any epoch.
 *
 * Hale-Bopp is left out on purpose: a = 186 AU puts its aphelion at 371 AU,
 * four times further than Eris, and its orbit would swamp the whole view.
 */
export type CometData = {
  name: string;
  designation: string;
  color: string;
  /** Nucleus diameter, km. */
  diameterKm: number;
  orbit: Elements;
  /** Sidereal period, years. */
  periodYears: number;
  /** Most recent well-observed perihelion passage. */
  perihelionDate: string;
  note: string;
};

/** Mean anomaly at J2000, from the perihelion passage and the mean period. */
const meanAnomalyAtJ2000 = (perihelionYear: number, periodYears: number) =>
  (((360 * (2000 - perihelionYear)) / periodYears) % 360 + 360) % 360;

const comet = (
  name: string,
  designation: string,
  color: string,
  diameterKm: number,
  a: number,
  e: number,
  iDeg: number,
  nodeDeg: number,
  periDeg: number,
  periodYears: number,
  perihelionDate: string,
  perihelionYear: number,
  note: string,
): CometData => ({
  name,
  designation,
  color,
  diameterKm,
  periodYears,
  perihelionDate,
  note,
  orbit: {
    a,
    e,
    iDeg,
    nodeDeg,
    periDeg,
    m0Deg: meanAnomalyAtJ2000(perihelionYear, periodYears),
  },
});

export const COMETS: CometData[] = [
  comet(
    "Halley", "1P/Halley", "#bfe6ff", 11,
    17.834, 0.96714, 162.26, 58.42, 111.33,
    75.32, "9 February 1986", 1986.107,
    "The one that made comets predictable: Halley saw the same object in 1531, 1607 and 1682, and correctly called its return for 1758. Its 162 degree inclination means it orbits backwards, and it is why we get the Orionid meteors.",
  ),
  comet(
    "Encke", "2P/Encke", "#d8e8c8", 4.8,
    2.2155, 0.8482, 11.78, 334.57, 186.55,
    3.30, "23 May 1997", 1997.39,
    "The shortest period of any known comet — barely three years, never further out than Jupiter. Jets from its own surface measurably alter its orbit, which is why its elements have to be re-fitted every few passes.",
  ),
  comet(
    "Swift-Tuttle", "109P/Swift-Tuttle", "#e8d8ff", 26,
    26.092, 0.96320, 113.45, 139.38, 153.00,
    133.28, "12 December 1992", 1992.947,
    "The largest object that repeatedly passes close to Earth, at 26 km across. Its debris stream is the Perseid meteor shower every August.",
  ),
];

/**
 * How bright and how long a tail should be, from the comet's distance.
 *
 * A comet is an inert lump of ice for almost all of its orbit; the coma and
 * tail only appear as sunlight starts to sublimate the surface, roughly inside
 * the asteroid belt. Falls off with the square of distance, like the sunlight
 * driving it, and is clamped to 1 near the sun where the simple model breaks.
 */
export const cometActivity = (distanceAu: number) => {
  if (distanceAu > 4.5) return 0;
  const raw = 1 / (distanceAu * distanceAu);
  return Math.min(1, raw) * Math.min(1, (4.5 - distanceAu) / 1.5);
};
