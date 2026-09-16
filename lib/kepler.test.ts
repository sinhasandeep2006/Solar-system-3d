import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import {
  DEG,
  type Elements,
  eccentricAnomaly,
  orbitPath,
  positionAt,
  radiusAt,
  trueAnomaly,
  wrapAngle,
} from "./kepler";

const el = (over: Partial<Elements> = {}): Elements => ({
  a: 1,
  e: 0,
  iDeg: 0,
  nodeDeg: 0,
  periDeg: 0,
  m0Deg: 0,
  ...over,
});

const TAU = Math.PI * 2;
const ECCENTRICITIES = [0, 0.0086, 0.0484, 0.0549, 0.2056, 0.2488, 0.4361, 0.7507];

describe("Kepler's equation", () => {
  it("returns an E that actually satisfies M = E - e*sin(E)", () => {
    for (const e of ECCENTRICITIES) {
      for (let k = 0; k < 64; k++) {
        const M = (k / 64) * TAU;
        const E = eccentricAnomaly(M, e);
        expect(E - e * Math.sin(E)).toBeCloseTo(M, 10);
      }
    }
  });

  it("degenerates to E = M for a circle", () => {
    for (let k = 0; k < 16; k++) {
      const M = (k / 16) * TAU;
      expect(eccentricAnomaly(M, 0)).toBeCloseTo(M, 12);
    }
  });

  it("handles negative and multi-turn mean anomalies", () => {
    for (const e of ECCENTRICITIES) {
      const base = eccentricAnomaly(1.2, e);
      expect(eccentricAnomaly(1.2 + TAU * 5, e)).toBeCloseTo(base, 9);
      expect(eccentricAnomaly(1.2 - TAU * 3, e)).toBeCloseTo(base, 9);
    }
  });

  it("puts the body at periapsis at M=0 and apoapsis at M=pi", () => {
    for (const e of ECCENTRICITIES) {
      expect(radiusAt(eccentricAnomaly(0, e), e)).toBeCloseTo(1 - e, 9);
      expect(radiusAt(eccentricAnomaly(Math.PI, e), e)).toBeCloseTo(1 + e, 9);
    }
  });

  it("agrees with the equation-of-centre series at small eccentricity", () => {
    const e = 0.01;
    for (let k = 1; k < 12; k++) {
      const M = (k / 12) * TAU;
      const series = M + 2 * e * Math.sin(M) + 1.25 * e * e * Math.sin(2 * M);
      expect(wrapAngle(trueAnomaly(eccentricAnomaly(M, e), e))).toBeCloseTo(wrapAngle(series), 4);
    }
  });
});

describe("orbit geometry", () => {
  const v = new Vector3();

  it("keeps |r| between periapsis and apoapsis, touching both", () => {
    for (const e of ECCENTRICITIES) {
      const orbit = el({ e, iDeg: 23, nodeDeg: 40, periDeg: 110 });
      let min = Infinity;
      let max = -Infinity;
      for (let k = 0; k < 720; k++) {
        const len = positionAt(orbit, (k / 720) * TAU, v).length();
        min = Math.min(min, len);
        max = Math.max(max, len);
      }
      expect(min).toBeCloseTo(1 - e, 4);
      expect(max).toBeCloseTo(1 + e, 4);
    }
  });

  it("obeys Kepler's second law: equal areas in equal times", () => {
    // The real test of the solver. Sampling at equal MEAN anomaly must sweep
    // equal area, which only happens if the body speeds up near periapsis.
    for (const e of [0.0484, 0.2488, 0.7507]) {
      const orbit = el({ e, iDeg: 17, nodeDeg: 110, periDeg: 224 });
      // Area is measured as a chord triangle, so the measurement itself carries
      // an O(dt^2) error — verified to fall 4x per doubling. 2880 steps puts it
      // safely under the 1e-4 bound asserted here.
      const steps = 2880;
      const areas: number[] = [];
      const p1 = new Vector3();
      const p2 = new Vector3();
      for (let k = 0; k < steps; k++) {
        positionAt(orbit, (k / steps) * TAU, p1);
        positionAt(orbit, ((k + 1) / steps) * TAU, p2);
        areas.push(p1.clone().cross(p2).length() / 2);
      }
      const mean = areas.reduce((s, x) => s + x, 0) / areas.length;
      const worst = Math.max(...areas.map((area) => Math.abs(area / mean - 1)));
      expect(worst).toBeLessThan(1e-4);
    }
  });

  it("stays in a single plane whose tilt is the inclination", () => {
    for (const iDeg of [0, 7.005, 17.14, 44.04]) {
      const orbit = el({ e: 0.3, iDeg, nodeDeg: 35, periDeg: 80 });
      const a = positionAt(orbit, 0.4, new Vector3());
      const b = positionAt(orbit, 2.1, new Vector3());
      const normal = a.clone().cross(b).normalize();
      for (let k = 0; k < 90; k++) {
        const p = positionAt(orbit, (k / 90) * TAU, v);
        expect(Math.abs(p.dot(normal))).toBeLessThan(1e-9);
      }
      // Scene Y is ecliptic north, so the plane's tilt from it IS the inclination.
      expect(Math.acos(Math.abs(normal.y)) / DEG).toBeCloseTo(iDeg, 6);
    }
  });

  it("runs prograde: counter-clockwise seen from scene +Y", () => {
    const orbit = el({ e: 0.2, iDeg: 5, nodeDeg: 0, periDeg: 0 });
    const a = positionAt(orbit, 0, new Vector3());
    const b = positionAt(orbit, 0.05, new Vector3());
    // Right-handed about +Y means the cross product points up.
    expect(a.cross(b).y).toBeGreaterThan(0);
  });

  it("scales with the semi-major axis instead of ignoring it", () => {
    // The bug this guards: positionAt once returned a unit-a vector, so every
    // caller silently lost the factor of `a` and the orbit order inverted.
    for (const a of [0.387, 1, 5.2, 67.9]) {
      const orbit = el({ a, e: 0.2, iDeg: 12, nodeDeg: 30, periDeg: 60 });
      expect(positionAt(orbit, 0, new Vector3()).length()).toBeCloseTo(a * 0.8, 9);
      expect(positionAt(orbit, Math.PI, new Vector3()).length()).toBeCloseTo(a * 1.2, 9);
      // The path lives in a Float32Array for the GPU, so 7 digits is its limit.
      const path = orbitPath(orbit, 8);
      expect(new Vector3(path[0], path[1], path[2]).length()).toBeCloseTo(a * 0.8, 6);
    }
    // Larger a must always draw further out, at equal phase.
    const near = positionAt(el({ a: 0.387, e: 0.2 }), 1.1, new Vector3()).length();
    const far = positionAt(el({ a: 30.07, e: 0.2 }), 1.1, new Vector3()).length();
    expect(far).toBeGreaterThan(near);
  });

  it("closes: one full revolution returns to the start", () => {
    const orbit = el({ e: 0.4361, iDeg: 44, nodeDeg: 36, periDeg: 151 });
    const start = positionAt(orbit, 0.7, new Vector3());
    const round = positionAt(orbit, 0.7 + TAU, new Vector3());
    expect(round.distanceTo(start)).toBeLessThan(1e-9);
  });
});

describe("orbit path", () => {
  it("traces the same curve the body flies along", () => {
    const orbit = el({ e: 0.2488, iDeg: 17.14, nodeDeg: 110.3, periDeg: 113.76 });
    const path = orbitPath(orbit, 512);
    expect(path.length).toBe(512 * 3);

    // Every sampled body position must land on the drawn path.
    const v = new Vector3();
    const point = new Vector3();
    for (let k = 0; k < 60; k++) {
      positionAt(orbit, (k / 60) * TAU, v);
      let nearest = Infinity;
      for (let j = 0; j < 512; j++) {
        point.set(path[j * 3], path[j * 3 + 1], path[j * 3 + 2]);
        nearest = Math.min(nearest, point.distanceTo(v));
      }
      expect(nearest).toBeLessThan(0.02);
    }
  });

  it("spaces points evenly rather than bunching them at apoapsis", () => {
    const path = orbitPath(el({ e: 0.7507 }), 256);
    const gaps: number[] = [];
    const p1 = new Vector3();
    const p2 = new Vector3();
    for (let k = 0; k < 256; k++) {
      p1.set(path[k * 3], path[k * 3 + 1], path[k * 3 + 2]);
      const j = (k + 1) % 256;
      p2.set(path[j * 3], path[j * 3 + 1], path[j * 3 + 2]);
      gaps.push(p1.distanceTo(p2));
    }
    // Sampling in mean anomaly would give a ratio near 40 at this eccentricity.
    expect(Math.max(...gaps) / Math.min(...gaps)).toBeLessThan(8);
  });
});
