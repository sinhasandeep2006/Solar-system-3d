import { describe, expect, it } from "vitest";
import { aphelionAu, DWARFS, elementsOf, perihelionAu, PLANETS, type PlanetData } from "./planets";
import { MOONS, moonsOf } from "./moons";
import { Vector3 } from "three";
import { DEG, positionAt } from "./kepler";
import {
  ASTEROID_BELT,
  KUIPER_BELT,
  keplerYears,
  moonDisplayRadius,
  moonOrbitRadius,
  moonOrbitShape,
  barycentreFraction,
  MOON_CLEARANCE,
  ringRadius,
  rotationsPerOrbit,
  spinAngularSpeed as spinAt,
  TRUE_SIZE_PER_KM,
  drawRadius,
  warpVector,
  SUN_RADIUS,
  COMPRESSED_C,
  TRUE_SCALE,
  clamp01,
  compressedRadius,
  displayRadius,
  orbitAngularSpeed,
  orbitRadius,
  spinAngularSpeed,
  trueRadius,
} from "./scale";

const byName = (n: string) => PLANETS.find((p) => p.name === n)!;

describe("orbit radius", () => {
  it("uses the specified formulas", () => {
    expect(compressedRadius(4)).toBeCloseTo(COMPRESSED_C * 2);
    expect(trueRadius(2)).toBeCloseTo(2 * TRUE_SCALE);
  });

  it("keeps planets in real order in both modes", () => {
    for (const blend of [0, 0.5, 1]) {
      const radii = PLANETS.map((p) => orbitRadius(p.orbit.a, blend));
      const sorted = [...radii].sort((a, b) => a - b);
      expect(radii).toEqual(sorted);
    }
  });

  it("compresses the outer system, true scale does not", () => {
    const n = byName("Neptune").orbit.a / byName("Earth").orbit.a; // ~30x
    const compressed =
      compressedRadius(byName("Neptune").orbit.a) / compressedRadius(byName("Earth").orbit.a);
    const real = trueRadius(byName("Neptune").orbit.a) / trueRadius(byName("Earth").orbit.a);
    expect(compressed).toBeLessThan(n / 4); // sqrt pulls 30x down to ~5.5x
    expect(real).toBeCloseTo(n, 6);
  });

  it("blends endpoints exactly and clamps out-of-range input", () => {
    expect(orbitRadius(9, 0)).toBeCloseTo(compressedRadius(9));
    expect(orbitRadius(9, 1)).toBeCloseTo(trueRadius(9));
    expect(orbitRadius(9, -3)).toBeCloseTo(compressedRadius(9));
    expect(orbitRadius(9, 7)).toBeCloseTo(trueRadius(9));
    expect(orbitRadius(9, 0.5)).toBeCloseTo((compressedRadius(9) + trueRadius(9)) / 2);
  });

  it("clamp01 handles NaN-free edges", () => {
    expect(clamp01(-0.1)).toBe(0);
    expect(clamp01(1.1)).toBe(1);
    expect(clamp01(0.25)).toBe(0.25);
  });
});

describe("display radius", () => {
  it("is monotonic in diameter and keeps Earth at the reference size", () => {
    expect(displayRadius(12_756)).toBeCloseTo(0.35);
    const sizes = [...PLANETS].sort((a, b) => a.diameterKm - b.diameterKm).map((p) => displayRadius(p.diameterKm));
    expect(sizes).toEqual([...sizes].sort((a, b) => a - b));
  });

  it("keeps every planet visible but smaller than the sun", () => {
    for (const p of PLANETS) {
      expect(displayRadius(p.diameterKm)).toBeGreaterThan(0.15);
      expect(displayRadius(p.diameterKm)).toBeLessThan(1.5);
    }
  });
});

describe("angular speeds", () => {
  it("orbits scale inversely with the real orbital period", () => {
    const earth = orbitAngularSpeed(byName("Earth").orbitYears);
    const neptune = orbitAngularSpeed(byName("Neptune").orbitYears);
    expect(earth / neptune).toBeCloseTo(byName("Neptune").orbitYears, 2);
    expect(orbitAngularSpeed(byName("Mercury").orbitYears)).toBeGreaterThan(earth);
  });

  it("spins scale inversely with the real day length", () => {
    const earth = spinAngularSpeed(byName("Earth").dayDays, false);
    const jupiter = spinAngularSpeed(byName("Jupiter").dayDays, false);
    expect(jupiter).toBeGreaterThan(earth); // Jupiter's day is ~10h
    expect(Math.abs(spinAngularSpeed(byName("Venus").dayDays, true))).toBeLessThan(earth);
  });

  it("makes Venus and Uranus spin backwards", () => {
    for (const p of PLANETS) {
      const s = spinAngularSpeed(p.dayDays, p.retrograde);
      expect(Math.sign(s)).toBe(p.retrograde ? -1 : 1);
    }
    expect(PLANETS.filter((p) => p.retrograde).map((p) => p.name)).toEqual(["Venus", "Uranus"]);
  });
});

describe("moon scale", () => {
  const earthR = displayRadius(12_756);

  it("puts every rendered moon outside its parent and in real order", () => {
    for (const p of [...PLANETS, ...DWARFS]) {
      const parentR = displayRadius(p.diameterKm);
      const moons = moonsOf(p.name);
      const radii = moons.map((mn) => moonOrbitRadius(parentR, mn.axisKm, p.diameterKm));
      for (const r of radii) expect(r).toBeGreaterThan(parentR * 1.5);
      // moons.ts lists each parent's moons inner-to-outer
      expect(radii).toEqual([...radii].sort((a, b) => a - b));
    }
  });

  it("keeps every planet's moon system clear of every other planet's orbit", () => {
    // Compressed mode is the worst case: that is where the orbits sit closest.
    const span = (b: PlanetData) => ({
      min: drawRadius(perihelionAu(b), 0),
      max: drawRadius(aphelionAu(b), 0),
    });

    for (const b of PLANETS) {
      const parentR = displayRadius(b.diameterKm);
      // Reach = the furthest a moon ever gets, so semi-major axis times (1+e).
      const reach = moonsOf(b.name).reduce((max, mn) => {
        const shape = moonOrbitShape(parentR, mn.axisKm, mn.e, b.diameterKm);
        return Math.max(max, shape.a * (1 + shape.e));
      }, 0);
      if (reach === 0) continue;

      const mine = span(b);
      for (const other of PLANETS) {
        if (other === b) continue;
        const theirs = span(other);
        const gap = theirs.min > mine.max ? theirs.min - mine.max : mine.min - theirs.max;
        expect(reach).toBeLessThan(gap);
      }
    }
  });

  it("draws two orbits as crossing only when they really cross", () => {
    // This is what the global radial map buys, and it is why compressed mode
    // stopped scaling each orbit by its own factor. Under the old scheme the
    // 38.3 AU perihelion of Eris was drawn down beside the 20.1 AU aphelion of
    // Uranus, and Pluto's dip inside Neptune disappeared. Now the drawn
    // ordering matches the real ordering for every pair, always.
    const bodies = [...PLANETS, ...DWARFS];
    for (const a of bodies) {
      for (const b of bodies) {
        if (a === b) continue;
        const realCross =
          perihelionAu(a) <= aphelionAu(b) && perihelionAu(b) <= aphelionAu(a);
        for (const blend of [0, 0.5, 1]) {
          const drawnCross =
            drawRadius(perihelionAu(a), blend) <= drawRadius(aphelionAu(b), blend) &&
            drawRadius(perihelionAu(b), blend) <= drawRadius(aphelionAu(a), blend);
          expect(drawnCross).toBe(realCross);
        }
      }
    }
  });

  it("maps distance monotonically, which is what guarantees that", () => {
    for (const blend of [0, 0.25, 0.5, 1]) {
      let previous = -Infinity;
      for (let au = 0.05; au < 100; au *= 1.07) {
        const drawn = drawRadius(au, blend);
        expect(drawn).toBeGreaterThan(previous);
        previous = drawn;
      }
    }
  });

  it("reproduces the real Neptune-Pluto crossing", () => {
    const neptune = PLANETS.find((p) => p.name === "Neptune")!;
    const pluto = DWARFS.find((p) => p.name === "Pluto")!;
    // Pluto spends part of every orbit closer to the sun than Neptune ever gets.
    expect(perihelionAu(pluto)).toBeCloseTo(29.66, 1);
    expect(perihelionAu(pluto)).toBeLessThan(perihelionAu(neptune));
    expect(aphelionAu(pluto)).toBeGreaterThan(aphelionAu(neptune));
  });

  it("sizes moons between the floor and the ceiling, ordered by diameter", () => {
    const jupiterR = displayRadius(142_984);
    const moons = moonsOf("Jupiter");
    for (const mn of moons) {
      const r = moonDisplayRadius(jupiterR, mn.diameterKm, 142_984);
      expect(r).toBeGreaterThanOrEqual(jupiterR * 0.1 - 1e-9);
      expect(r).toBeLessThanOrEqual(jupiterR * 0.4 + 1e-9);
    }
    const ganymede = moonDisplayRadius(jupiterR, 5_268, 142_984);
    const amalthea = moonDisplayRadius(jupiterR, 167, 142_984);
    expect(ganymede).toBeGreaterThan(amalthea);
  });

  it("orbits the Moon ~13x for each Earth year, matching reality", () => {
    const moon = orbitAngularSpeed(27.322 / 365.25);
    const earth = orbitAngularSpeed(1);
    expect(moon / earth).toBeCloseTo(365.25 / 27.322, 3);
    expect(earthR).toBeGreaterThan(0);
  });

  it("makes Triton and Phoebe orbit backwards", () => {
    expect(MOONS.filter((mn) => mn.retrograde).map((mn) => mn.name)).toEqual(["Phoebe", "Triton"]);
  });

  it("lists every system inner to outer, and gives every moon real details", () => {
    for (const b of [...PLANETS, ...DWARFS]) {
      const axes = moonsOf(b.name).map((mn) => mn.axisKm);
      expect(axes).toEqual([...axes].sort((x, y) => x - y));
    }
    for (const mn of MOONS) {
      expect(mn.e).toBeGreaterThanOrEqual(0);
      expect(mn.e).toBeLessThan(1); // bound, not captured
      expect(mn.inclinationDeg).toBeGreaterThanOrEqual(0);
      expect(mn.inclinationDeg).toBeLessThanOrEqual(90);
      expect(mn.massKg).toBeGreaterThan(0);
      expect(mn.note.length).toBeGreaterThan(20);
      expect(mn.discoverer.length).toBeGreaterThan(0);
    }
    // Nereid is the eccentricity outlier and the reason ellipses are worth it.
    const nereid = MOONS.find((mn) => mn.name === "Nereid")!;
    expect(nereid.e).toBeGreaterThan(0.7);
  });
});

describe("rings", () => {
  it("places ring edges at their real multiple of the planet radius", () => {
    const saturn = PLANETS.find((p) => p.name === "Saturn")!;
    const r = displayRadius(saturn.diameterKm);
    const bands = saturn.rings!.bands;
    const inner = ringRadius(r, bands[0].innerKm, saturn.diameterKm);
    const outer = ringRadius(r, bands[bands.length - 1].outerKm, saturn.diameterKm);
    expect(inner / r).toBeCloseTo(74_500 / 60_268, 3); // C ring, ~1.24 R
    expect(outer / r).toBeCloseTo(136_775 / 60_268, 3); // A ring edge, ~2.27 R
    expect(outer).toBeGreaterThan(inner);
    expect(inner).toBeGreaterThan(r);
  });

  it("leaves the Cassini Division empty and keeps all bands ordered", () => {
    for (const p of PLANETS.filter((x) => x.rings)) {
      let prevOuter = p.diameterKm / 2; // must start outside the planet
      for (const b of p.rings!.bands) {
        expect(b.innerKm).toBeGreaterThanOrEqual(prevOuter);
        expect(b.outerKm).toBeGreaterThan(b.innerKm);
        prevOuter = b.outerKm;
      }
    }
    const saturn = PLANETS.find((p) => p.name === "Saturn")!.rings!.bands;
    expect(saturn[2].innerKm - saturn[1].outerKm).toBeCloseTo(4_590, 0); // Cassini
  });

  it("only gives rings to the four planets that have them", () => {
    expect(PLANETS.filter((p) => p.rings).map((p) => p.name)).toEqual([
      "Jupiter",
      "Saturn",
      "Uranus",
      "Neptune",
    ]);
  });
});

describe("belts", () => {
  it("obeys Kepler: inner belt rocks lap outer ones", () => {
    expect(keplerYears(1)).toBeCloseTo(1);
    expect(keplerYears(4)).toBeCloseTo(8);
    expect(keplerYears(ASTEROID_BELT.maxAu)).toBeGreaterThan(keplerYears(ASTEROID_BELT.minAu));
    const inner = orbitAngularSpeed(keplerYears(ASTEROID_BELT.minAu));
    const outer = orbitAngularSpeed(keplerYears(ASTEROID_BELT.maxAu));
    expect(inner).toBeGreaterThan(outer);
  });

  it("brackets the asteroid belt around Ceres and the Kuiper belt around Pluto", () => {
    const ceres = DWARFS.find((p) => p.name === "Ceres")!;
    expect(ceres.orbit.a).toBeGreaterThan(ASTEROID_BELT.minAu);
    expect(ceres.orbit.a).toBeLessThan(ASTEROID_BELT.maxAu);
    const pluto = DWARFS.find((p) => p.name === "Pluto")!;
    expect(pluto.orbit.a).toBeGreaterThan(KUIPER_BELT.minAu);
    expect(pluto.orbit.a).toBeLessThan(KUIPER_BELT.maxAu);
  });
});

describe("drawn scene positions (the composition the components use)", () => {
  // These exercise positionAt -> warpVector exactly as Planet.tsx does. The
  // unit tests above passed while the components were inverted, because each
  // half was correct on its own and only the composition was wrong.
  const drawn = (b: PlanetData, blend: number, years = 0) => {
    const el = elementsOf(b, years);
    const v = positionAt(el, el.m0Deg * DEG, new Vector3());
    warpVector(v, blend);
    return v;
  };

  it("draws every body inside its own perihelion-aphelion band", () => {
    for (const blend of [0, 0.5, 1]) {
      for (const b of [...PLANETS, ...DWARFS]) {
        const r = drawn(b, blend).length();
        expect(r).toBeGreaterThanOrEqual(drawRadius(perihelionAu(b), blend) - 1e-9);
        expect(r).toBeLessThanOrEqual(drawRadius(aphelionAu(b), blend) + 1e-9);
      }
    }
  });

  it("draws the planets outward in the right order in both modes", () => {
    for (const blend of [0, 1]) {
      // Compare each planet's drawn semi-major axis, which is the ordering the
      // viewer actually perceives. Mercury innermost, Neptune outermost.
      const radii = PLANETS.map((b) => drawRadius(b.orbit.a, blend));
      expect(radii).toEqual([...radii].sort((x, y) => x - y));
      // And the drawn bands must not have Neptune inside Mercury.
      const inner = drawRadius(aphelionAu(PLANETS[0]), blend);
      const outer = drawRadius(perihelionAu(PLANETS[7]), blend);
      expect(outer).toBeGreaterThan(inner);
    }
  });

  it("keeps the sun clear: nothing is drawn inside the sun's own radius", () => {
    for (const blend of [0, 1]) {
      for (const b of [...PLANETS, ...DWARFS]) {
        expect(drawRadius(perihelionAu(b), blend)).toBeGreaterThan(SUN_RADIUS);
      }
    }
  });
});

describe("positions against independently known J2000 values", () => {
  // Validates the whole chain: data -> elementsOf -> Kepler solver -> vector.
  const helio = (name: string) => {
    const body = [...PLANETS, ...DWARFS].find((b) => b.name === name)!;
    const el = elementsOf(body);
    const p = positionAt(el, el.m0Deg * DEG, new Vector3());
    // Scene (x, y, z) came from ecliptic (x, z, -y), so undo that to read
    // longitude in the conventional frame. positionAt already applies el.a.
    const lon = (Math.atan2(-p.z, p.x) / DEG + 360) % 360;
    return { lon, r: p.length() };
  };

  it("puts Earth where the Sun's J2000 longitude says it must be", () => {
    const earth = helio("Earth");
    // The Sun's geometric longitude at J2000.0 is 280.385 deg, and Earth sits
    // exactly opposite it. Independent of anything in this codebase.
    expect((earth.lon + 180) % 360).toBeCloseTo(280.385, 2);
    // Earth passes perihelion in early January, so J2000.0 is near closest.
    expect(earth.r).toBeCloseTo(0.9833, 3);
  });

  it("puts Pluto at its known J2000 distance, past its 1989 perihelion", () => {
    const pluto = helio("Pluto");
    expect(pluto.r).toBeCloseTo(30.23, 1);
    expect(pluto.r).toBeGreaterThan(perihelionAu(PLANETS.find((p) => p.name === "Neptune")!));
  });

  it("keeps every body inside its own perihelion-aphelion band at J2000", () => {
    for (const b of [...PLANETS, ...DWARFS]) {
      const { r } = helio(b.name);
      expect(r).toBeGreaterThanOrEqual(perihelionAu(b) - 1e-9);
      expect(r).toBeLessThanOrEqual(aphelionAu(b) + 1e-9);
    }
  });
});

describe("drawn moon positions (the composition Moon.tsx uses)", () => {
  // Same bug class as the planet one: Moon.tsx feeds the scene-unit orbit
  // radius in as Elements.a, so nothing may multiply by it a second time.
  it("keeps every moon inside its own drawn periapsis-apoapsis band", () => {
    for (const parent of [...PLANETS, ...DWARFS]) {
      const parentR = displayRadius(parent.diameterKm);
      for (const mn of moonsOf(parent.name)) {
        const shape = moonOrbitShape(parentR, mn.axisKm, mn.e, parent.diameterKm);
        const el = {
          a: shape.a,
          e: shape.e,
          iDeg: mn.inclinationDeg,
          nodeDeg: 0,
          periDeg: 0,
          m0Deg: 0,
        };
        let min = Infinity;
        let max = -Infinity;
        for (let k = 0; k < 180; k++) {
          const r = positionAt(el, (k / 180) * Math.PI * 2, new Vector3()).length();
          min = Math.min(min, r);
          max = Math.max(max, r);
        }
        // The drawn ellipse keeps the moon's REAL eccentricity, exactly.
        expect(shape.e).toBe(mn.e);
        expect(min).toBeCloseTo(shape.a * (1 - mn.e), 3);
        expect(max).toBeCloseTo(shape.a * (1 + mn.e), 3);
        // And every moon clears its parent's surface, by construction.
        expect(min).toBeGreaterThanOrEqual(parentR * MOON_CLEARANCE - 1e-9);
      }
    }
  });
});

describe("precession (JPL secular rates)", () => {
  const byName = (n: string) => [...PLANETS, ...DWARFS].find((b) => b.name === n)!;

  it("advances Mercury's perihelion at the rate JPL publishes", () => {
    // The classic one. 0.1605 deg/century of the total apsidal precession.
    const now = elementsOf(byName("Mercury"), 0);
    const later = elementsOf(byName("Mercury"), 100);
    const advance = later.periDeg + later.nodeDeg - (now.periDeg + now.nodeDeg);
    expect(advance).toBeCloseTo(0.16047689, 6);
  });

  it("drifts the nodes and breathes the eccentricities", () => {
    const saturnNow = elementsOf(byName("Saturn"), 0);
    const saturnLater = elementsOf(byName("Saturn"), 100);
    expect(saturnLater.nodeDeg - saturnNow.nodeDeg).toBeCloseTo(-0.28867794, 6);
    expect(saturnLater.e - saturnNow.e).toBeCloseTo(-0.00050991, 8);
    expect(saturnLater.a - saturnNow.a).toBeCloseTo(-0.0012506, 8);
  });

  it("takes exactly one sidereal year for Earth to come back round", () => {
    const start = elementsOf(byName("Earth"), 0);
    const year = elementsOf(byName("Earth"), 1);
    // Mean longitude advances 35999.37 deg/century, so 359.9937 deg in a year.
    const moved = year.m0Deg + year.periDeg + year.nodeDeg - (start.m0Deg + start.periDeg + start.nodeDeg);
    expect(moved).toBeCloseTo(359.9937, 3);
  });

  it("stays physical over the range JPL supports", () => {
    // 1800-2050 is -200 to +50 years from J2000.
    for (const years of [-200, -100, 0, 25, 50]) {
      for (const b of PLANETS) {
        const el = elementsOf(b, years);
        expect(el.a).toBeGreaterThan(0);
        expect(el.e).toBeGreaterThanOrEqual(0);
        expect(el.e).toBeLessThan(1);
        expect(Math.abs(el.a - b.orbit.a)).toBeLessThan(0.02);
      }
    }
  });

  it("actually turns the orbit in space, not just the body along it", () => {
    // Sample the same point in the orbit 200 years apart: it must have moved
    // because the ellipse itself has rotated.
    const mercury = byName("Mercury");
    const at = (years: number) => positionAt(elementsOf(mercury, years), 0, new Vector3());
    expect(at(0).angleTo(at(200))).toBeGreaterThan(0.004); // ~0.32 deg of apsidal drift
  });

  it("leaves the dwarfs unprecessed, since JPL publishes no rates for them", () => {
    for (const d of DWARFS) {
      expect(d.orbit.periLonRate).toBe(0);
      expect(d.orbit.nodeRate).toBe(0);
      // But they still orbit: mean longitude rate comes from the real period.
      expect(d.orbit.meanLonRate).toBeGreaterThan(0);
      expect(36000 / d.orbit.meanLonRate).toBeCloseTo(d.orbitYears, 1);
    }
  });
});

describe("true sizes and true spin", () => {
  it("uses exact diameter ratios when true sizes are on", () => {
    const jupiter = 142_984;
    const earth = 12_756;
    expect(displayRadius(jupiter, true) / displayRadius(earth, true)).toBeCloseTo(
      jupiter / earth,
      9,
    );
    expect(displayRadius(jupiter, true)).toBeCloseTo(1.6, 9);
    expect(TRUE_SIZE_PER_KM * jupiter).toBeCloseTo(1.6, 9);
  });

  it("and squashes that ratio when the cosmetic curve is on", () => {
    const real = 142_984 / 12_756; // 11.2x
    const cosmetic = displayRadius(142_984) / displayRadius(12_756);
    expect(cosmetic).toBeLessThan(real / 3);
    expect(cosmetic).toBeGreaterThan(1); // still visibly the biggest
  });

  it("counts 366.25 sidereal rotations in an Earth year, not 365.25", () => {
    // A year contains one more inertial rotation than it does solar days.
    expect(rotationsPerOrbit(1, 0.99727)).toBeCloseTo(366.25, 1);
    expect(rotationsPerOrbit(1, 1)).toBeCloseTo(365.25, 6);
  });

  it("locks spin to the orbit when true spin is on", () => {
    const earth = PLANETS.find((p) => p.name === "Earth")!;
    const orbitRate = orbitAngularSpeed(earth.orbitYears);
    const spinRate = spinAt(earth.dayDays, earth.retrograde, earth.orbitYears);
    expect(spinRate / orbitRate).toBeCloseTo(rotationsPerOrbit(earth.orbitYears, earth.dayDays), 6);
  });

  it("keeps retrograde rotators backwards in both spin modes", () => {
    for (const b of PLANETS) {
      const sign = b.retrograde ? -1 : 1;
      expect(Math.sign(spinAt(b.dayDays, b.retrograde))).toBe(sign);
      expect(Math.sign(spinAt(b.dayDays, b.retrograde, b.orbitYears))).toBe(sign);
    }
  });
});

describe("barycentre wobble", () => {
  it("puts the Pluto-Charon barycentre outside Pluto itself", () => {
    const pluto = DWARFS.find((p) => p.name === "Pluto")!;
    const charon = MOONS.find((m) => m.name === "Charon")!;
    const fraction = barycentreFraction(pluto.massKg, charon.massKg);
    expect(fraction).toBeCloseTo(0.1085, 3);
    // Real separation is 19,591 km and Pluto's radius is 1,188 km.
    const plutoFromBarycentre = fraction * charon.axisKm;
    expect(plutoFromBarycentre).toBeCloseTo(2126, -1);
    expect(plutoFromBarycentre).toBeGreaterThan(pluto.diameterKm / 2);
  });

  it("keeps every other barycentre inside its planet", () => {
    for (const b of [...PLANETS, ...DWARFS]) {
      if (b.name === "Pluto") continue;
      for (const m of moonsOf(b.name)) {
        const offset = barycentreFraction(b.massKg, m.massKg) * m.axisKm;
        expect(offset).toBeLessThan(b.diameterKm / 2);
      }
    }
  });

  it("displaces Earth measurably but Mars not at all", () => {
    const earth = PLANETS.find((p) => p.name === "Earth")!;
    const moon = MOONS.find((m) => m.name === "Moon")!;
    const mars = PLANETS.find((p) => p.name === "Mars")!;
    const phobos = MOONS.find((m) => m.name === "Phobos")!;
    expect(barycentreFraction(earth.massKg, moon.massKg)).toBeCloseTo(0.0121, 3);
    expect(barycentreFraction(mars.massKg, phobos.massKg)).toBeLessThan(1e-7);
  });
});
