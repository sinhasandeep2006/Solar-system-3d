"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BufferAttribute, BufferGeometry, Points, Vector3 } from "three";
import { anim } from "@/lib/store";
import { keplerYears, orbitAngularSpeed, warpVector } from "@/lib/scale";
import { type Elements, positionAt } from "@/lib/kepler";

const scratch = new Vector3();

type Rock = { el: Elements; omega: number; phase: number };

/**
 * Deterministic layout so a belt never reshuffles on a re-render. Lives at
 * module scope because the LCG mutates a local across closure calls, which
 * the React compiler rightly refuses inside a component body.
 */
function layOutRocks(
  count: number,
  minAu: number,
  maxAu: number,
  spreadE: number,
  spreadI: number,
  seed: number,
): Rock[] {
  let s = seed;
  const rand = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  return Array.from({ length: count }, () => {
    const a = minAu + rand() * (maxAu - minAu);
    return {
      // Real belts are not tidy circles, but nor are they uniformly scattered:
      // both eccentricity and inclination are strongly peaked near zero with a
      // long tail. Squaring a uniform sample gives that shape, which is both
      // more honest than a flat spread and far less of a fog on screen.
      el: {
        a,
        e: rand() ** 1.7 * spreadE,
        iDeg: rand() ** 2 * spreadI,
        nodeDeg: rand() * 360,
        periDeg: rand() * 360,
        m0Deg: 0,
      },
      omega: orbitAngularSpeed(keplerYears(a)), // period = a^1.5, inner rocks lap outer
      phase: rand() * Math.PI * 2,
    };
  });
}

/**
 * A belt of small bodies on real Keplerian orbits.
 *
 * Drawn as points rather than meshes. Real belt objects are kilometres across,
 * so at any honest scale they are far under a pixel — they are markers, not
 * modelled bodies. sizeAttenuation={false} pins them to a constant pixel size,
 * which is what keeps the belt legible whether you are looking at the whole
 * system or standing next to Mars. As instanced dodecahedra they were 0.035
 * scene units, about a third of a pixel at system zoom, so invisible.
 *
 * It is also cheaper than instancing: one vector write per rock per frame
 * rather than composing a full matrix.
 *
 * ponytail: one Kepler solve per rock per frame, ~3200 rocks. Newton converges
 * in 3-4 steps at these eccentricities. Past ~20k, move it to a vertex shader.
 */
export default function Belt({
  count,
  minAu,
  maxAu,
  spreadE,
  spreadI,
  color,
  size,
  opacity,
  seed,
}: {
  count: number;
  minAu: number;
  maxAu: number;
  /** Upper bound on the eccentricity handed to individual rocks. */
  spreadE: number;
  /** Upper bound on the inclination handed to individual rocks, degrees. */
  spreadI: number;
  color: string;
  /** Point size in pixels, held constant regardless of distance. */
  size: number;
  opacity: number;
  seed: number;
}) {
  const points = useRef<Points>(null);

  const rocks = useMemo(
    () => layOutRocks(count, minAu, maxAu, spreadE, spreadI, seed),
    [count, minAu, maxAu, spreadE, spreadI, seed],
  );

  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(count * 3), 3));
    return g;
  }, [count]);

  useFrame(() => {
    if (!points.current) return;
    const attr = geometry.getAttribute("position") as BufferAttribute;
    const array = attr.array as Float32Array;

    for (let i = 0; i < rocks.length; i++) {
      const rock = rocks[i];
      positionAt(rock.el, rock.phase + rock.omega * anim.simYears * 12, scratch);
      warpVector(scratch, anim.scaleBlend);
      array[i * 3] = scratch.x;
      array[i * 3 + 1] = scratch.y;
      array[i * 3 + 2] = scratch.z;
    }
    attr.needsUpdate = true;
  });

  return (
    <points ref={points} geometry={geometry} frustumCulled={false} raycast={() => null}>
      <pointsMaterial
        color={color}
        size={size}
        sizeAttenuation={false}
        transparent
        opacity={opacity}
        depthWrite={false}
      />
    </points>
  );
}
