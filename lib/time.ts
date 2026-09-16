/**
 * Simulation time. Everything in the scene is driven by one number —
 * `anim.simYears`, Julian years since the J2000 epoch — so making the clock
 * addressable is what turns the app from a frozen diagram into something you
 * can ask questions of.
 */

/** J2000.0 = 2000 January 1, 12:00 TT. Close enough to UTC noon for our use. */
export const J2000_MS = Date.UTC(2000, 0, 1, 12, 0, 0);

/** A Julian year, which is what the JPL element rates are quoted against. */
export const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;

export const dateToSimYears = (date: Date) => (date.getTime() - J2000_MS) / YEAR_MS;

export const simYearsToDate = (years: number) => new Date(J2000_MS + years * YEAR_MS);

/** The window JPL publishes these elements as accurate over. */
export const ACCURATE_FROM = 1800;
export const ACCURATE_TO = 2050;

export const isAccurate = (years: number) => {
  const y = simYearsToDate(years).getUTCFullYear();
  return y >= ACCURATE_FROM && y <= ACCURATE_TO;
};

export function formatDate(years: number) {
  const d = simYearsToDate(years);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** yyyy-mm-dd, for <input type="date">. Negative years have no representation. */
export function toDateInput(years: number) {
  const d = simYearsToDate(years);
  if (d.getUTCFullYear() < 1 || d.getUTCFullYear() > 9999) return "";
  return d.toISOString().slice(0, 10);
}

// ---- Speed -------------------------------------------------------------
/**
 * The slider carries a raw value; the speed is its cube over 8.
 *
 * A linear slider is useless here: you want single-day precision near zero AND
 * centuries per second at the end, and those differ by four orders of
 * magnitude. Cubing gives fine control around the middle and a long reach at
 * the ends, from one <input type="range"> and one line of arithmetic.
 *
 * Raw 2 lands exactly on 1x, so the default still reads as "real-ish time".
 * Negative raw runs the whole system backwards; zero is paused.
 */
export const SPEED_RAW_MAX = 8;
export const rawToSpeed = (raw: number) => (raw * raw * raw) / 8;
export const speedToRaw = (speed: number) => Math.cbrt(speed * 8);

/** Human reading of a speed multiplier, e.g. "1 year every 12 s". */
export function describeSpeed(speed: number) {
  if (speed === 0) return "paused";
  const secondsPerYear = 12 / Math.abs(speed);
  const direction = speed < 0 ? " backwards" : "";
  if (secondsPerYear >= 1) return `1 year every ${secondsPerYear.toFixed(1)} s${direction}`;
  const yearsPerSecond = 1 / secondsPerYear;
  return `${yearsPerSecond.toFixed(0)} years a second${direction}`;
}
