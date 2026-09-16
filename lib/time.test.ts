import { describe, expect, it } from "vitest";
import {
  dateToSimYears,
  describeSpeed,
  formatDate,
  isAccurate,
  J2000_MS,
  rawToSpeed,
  simYearsToDate,
  speedToRaw,
  toDateInput,
} from "./time";
import {
  geocentricTrack,
  retrogradeSpans,
  shortestDelta,
  synodicYears,
} from "./retrograde";
import { PLANETS } from "./planets";

const byName = (n: string) => PLANETS.find((p) => p.name === n)!;

/**
 * Spans that do not touch either end of the window. A window can open or
 * close in the middle of a retrograde arc, and half an arc has its midpoint
 * in the wrong place — that is a sampling artifact, not a claim about the sky.
 */
const whole = (spans: [number, number][], length: number) =>
  spans.filter(([a, b]) => a > 0 && b < length - 1);

describe("simulation clock", () => {
  it("anchors zero at J2000", () => {
    expect(dateToSimYears(new Date(J2000_MS))).toBe(0);
    expect(simYearsToDate(0).getTime()).toBe(J2000_MS);
    expect(simYearsToDate(0).getUTCFullYear()).toBe(2000);
  });

  it("round-trips dates through the clock", () => {
    for (const iso of ["1969-07-20", "1986-02-09", "2026-09-16", "2049-12-31"]) {
      const date = new Date(`${iso}T12:00:00Z`);
      const back = simYearsToDate(dateToSimYears(date));
      expect(Math.abs(back.getTime() - date.getTime())).toBeLessThan(1000);
      expect(toDateInput(dateToSimYears(date))).toBe(iso);
    }
  });

  it("counts a Julian year as 365.25 days", () => {
    const start = dateToSimYears(new Date(Date.UTC(2000, 0, 1, 12)));
    const later = dateToSimYears(new Date(Date.UTC(2000, 0, 1, 12) + 365.25 * 86400000));
    expect(later - start).toBeCloseTo(1, 12);
  });

  it("knows where the JPL elements stop being accurate", () => {
    expect(isAccurate(dateToSimYears(new Date("2026-09-16T12:00:00Z")))).toBe(true);
    expect(isAccurate(dateToSimYears(new Date("1799-01-01T12:00:00Z")))).toBe(false);
    expect(isAccurate(dateToSimYears(new Date("2051-01-01T12:00:00Z")))).toBe(false);
  });

  it("formats a readable date", () => {
    expect(formatDate(dateToSimYears(new Date("1969-07-20T12:00:00Z")))).toContain("1969");
    expect(formatDate(0)).toContain("2000");
  });
});

describe("speed curve", () => {
  it("puts 1x exactly on the middle of the slider", () => {
    expect(rawToSpeed(2)).toBe(1);
    expect(speedToRaw(1)).toBeCloseTo(2, 12);
  });

  it("is a clean round trip and monotonic through zero", () => {
    let previous = -Infinity;
    for (let raw = -8; raw <= 8; raw += 0.25) {
      const speed = rawToSpeed(raw);
      expect(speed).toBeGreaterThan(previous);
      expect(speedToRaw(speed)).toBeCloseTo(raw, 9);
      previous = speed;
    }
  });

  it("pauses at zero and runs backwards below it", () => {
    expect(rawToSpeed(0)).toBe(0);
    expect(rawToSpeed(-2)).toBe(-1);
    expect(describeSpeed(0)).toBe("paused");
    expect(describeSpeed(-1)).toContain("backwards");
  });

  it("reaches centuries per second at the top without losing fine control", () => {
    expect(rawToSpeed(8)).toBe(64); // ~5 years a second
    expect(Math.abs(rawToSpeed(0.25))).toBeLessThan(0.01); // days per second
  });
});

describe("retrograde motion", () => {
  it("measures longitude differences the short way round", () => {
    expect(shortestDelta(10, 20)).toBe(10);
    expect(shortestDelta(350, 10)).toBe(20); // across the wrap, still forward
    expect(shortestDelta(10, 350)).toBe(-20); // genuinely backwards
  });

  it("makes Mars loop backwards, and about once per synodic period", () => {
    // Mars laps with Earth every 2.135 years, so a 6.5 year window must hold
    // three retrograde arcs — no more, no less.
    const mars = byName("Mars");
    expect(synodicYears(mars)).toBeCloseTo(2.135, 2);
    const track = geocentricTrack(mars, 0, 6.5, 900);
    expect(retrogradeSpans(track).length).toBe(3);
  });

  it("retrogrades every planet, inner and outer alike", () => {
    for (const p of PLANETS) {
      if (p.name === "Earth") continue;
      const window = Math.min(synodicYears(p) * 1.6, 40);
      const track = geocentricTrack(p, 0, window, 1200);
      expect(retrogradeSpans(track).length).toBeGreaterThanOrEqual(1);
    }
  });

  it("centres every outer-planet retrograde arc on opposition", () => {
    // This is the mechanism, not a coincidence: an outer planet only appears
    // to reverse while Earth is overtaking it on the inside, which is exactly
    // when the sun, Earth and the planet line up and it is closest.
    for (const name of ["Mars", "Jupiter", "Saturn"]) {
      const body = byName(name);
      const track = geocentricTrack(body, 0, synodicYears(body) * 2.2, 1400);
      const spans = whole(retrogradeSpans(track), track.length);
      expect(spans.length).toBeGreaterThanOrEqual(1);
      for (const [start, end] of spans) {
        const mid = track[Math.round((start + end) / 2)];
        expect(mid.elongationDeg).toBeGreaterThan(150);
      }
    }
  });

  it("centres every inner-planet retrograde arc on inferior conjunction", () => {
    // The inner planets reverse for the opposite reason: THEY overtake US,
    // passing between Earth and the sun, so elongation goes to nearly zero.
    for (const name of ["Mercury", "Venus"]) {
      const body = byName(name);
      const track = geocentricTrack(body, 0, synodicYears(body) * 2.2, 1400);
      const spans = whole(retrogradeSpans(track), track.length);
      expect(spans.length).toBeGreaterThanOrEqual(1);
      for (const [start, end] of spans) {
        const mid = track[Math.round((start + end) / 2)];
        expect(mid.elongationDeg).toBeLessThan(30);
      }
    }
  });

  it("keeps Venus within its real greatest elongation of 47 degrees", () => {
    const track = geocentricTrack(byName("Venus"), 0, 4, 900);
    const widest = Math.max(...track.map((p) => p.elongationDeg));
    expect(widest).toBeGreaterThan(44);
    expect(widest).toBeLessThan(48);
  });

  it("never lets Earth appear further than the sum of the two orbits", () => {
    const track = geocentricTrack(byName("Jupiter"), 0, 12, 400);
    for (const point of track) {
      expect(point.distanceAu).toBeGreaterThan(0);
      expect(point.distanceAu).toBeLessThan(7); // Jupiter aphelion + Earth aphelion
      expect(point.lonDeg).toBeGreaterThanOrEqual(0);
      expect(point.lonDeg).toBeLessThan(360);
      expect(Math.abs(point.latDeg)).toBeLessThan(90);
    }
  });
});

describe("against the real sky: Mars 2020-2027", () => {
  // Published opposition and retrograde dates. These are observations, not
  // anything derived in this codebase, so agreement here validates the whole
  // chain at once: JPL elements, secular rates, the Kepler solver, the
  // geocentric transform and the retrograde detector.
  const mars = () => PLANETS.find((p) => p.name === "Mars")!;
  const at = (iso: string) => dateToSimYears(new Date(`${iso}T12:00:00Z`));
  const daysApart = (years: number, iso: string) => Math.abs(years - at(iso)) * 365.25;

  const CYCLES = [
    { window: ["2020-06-01", "2021-03-01"], opposition: "2020-10-13", start: "2020-09-09", end: "2020-11-13" },
    { window: ["2022-08-01", "2023-05-01"], opposition: "2022-12-08", start: "2022-10-30", end: "2023-01-12" },
    { window: ["2024-09-01", "2025-06-01"], opposition: "2025-01-16", start: "2024-12-06", end: "2025-02-23" },
    { window: ["2026-10-01", "2027-07-01"], opposition: "2027-02-19", start: "2027-01-10", end: "2027-04-01" },
  ];

  for (const cycle of CYCLES) {
    it(`matches the ${cycle.opposition.slice(0, 4)} opposition and retrograde to within 2 days`, () => {
      const track = geocentricTrack(mars(), at(cycle.window[0]), at(cycle.window[1]), 6000);

      const opposition = track.reduce((best, p) => (p.elongationDeg > best.elongationDeg ? p : best));
      expect(daysApart(opposition.years, cycle.opposition)).toBeLessThan(2);

      const [a, b] = whole(retrogradeSpans(track), track.length)[0];
      expect(daysApart(track[a].years, cycle.start)).toBeLessThan(2);
      expect(daysApart(track[b].years, cycle.end)).toBeLessThan(2);
    });
  }
});
