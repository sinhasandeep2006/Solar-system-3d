"use client";

import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useCursor } from "@react-three/drei";
import {
  AdditiveBlending,
  type LineLoop,
  type MeshStandardMaterial,
  type PointsMaterial,
  BufferAttribute,
  BufferGeometry,
  Group,
  Mesh,
  Points,
  Vector3,
} from "three";
import { cometActivity, type CometData } from "@/lib/comets";
import { orbitPath, positionAt } from "@/lib/kepler";
import { anim, useSolar } from "@/lib/store";
import { warpPath, warpVector } from "@/lib/scale";

type TailPoint = { along: number; spreadX: number; spreadY: number; spreadZ: number };

/**
 * Tail particles: a position along the tail plus a fixed lateral jitter, so
 * the tail reads as a spreading cone rather than a laser beam. At module
 * scope because the generator mutates a local across closure calls, which the
 * React compiler refuses inside a component body.
 */
function layOutTail(seedText: string): TailPoint[] {
  let s = seedText.length * 7919 + seedText.charCodeAt(0);
  const rand = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  return Array.from({ length: TAIL_POINTS }, () => {
    const along = rand() ** 0.7; // bunched near the nucleus
    return {
      along,
      spreadX: (rand() - 0.5) * along,
      spreadY: (rand() - 0.5) * along,
      spreadZ: (rand() - 0.5) * along,
    };
  });
}

const PATH_SEGMENTS = 400;
const TAIL_POINTS = 260;
/** Longest the tail is ever drawn, in scene units. */
const TAIL_MAX = 9;

export default function Comet({ data }: { data: CometData }) {
  const group = useRef<Group>(null);
  const nucleus = useRef<Mesh>(null);
  const tail = useRef<Points>(null);
  const path = useRef<LineLoop>(null);
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);

  const focused = useSolar((s) => s.focused);
  const setFocused = useSolar((s) => s.setFocused);
  const showOrbits = useSolar((s) => s.showOrbits);

  const position = useRef(new Vector3()).current;
  const antiSun = useRef(new Vector3()).current;
  const pathState = useRef(-1);

  // The orbit never precesses here, so the AU-space path is computed once and
  // only the warp is redone when the scale mode changes.
  const auPath = useMemo(() => orbitPath(data.orbit, PATH_SEGMENTS), [data.orbit]);
  const pathGeometry = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(PATH_SEGMENTS * 3), 3));
    return g;
  }, []);

  const tailShape = useMemo(() => layOutTail(data.name), [data.name]);

  const tailGeometry = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(TAIL_POINTS * 3), 3));
    return g;
  }, []);

  const radius = 0.05;

  useFrame(() => {
    const blend = anim.scaleBlend;
    const el = data.orbit;
    // Mean motion straight from the real period; no precession modelled.
    const mean = (el.m0Deg * Math.PI) / 180 + (anim.simYears / data.periodYears) * Math.PI * 2;

    positionAt(el, mean, position);
    const distanceAu = position.length();
    warpVector(position, blend);

    if (group.current) group.current.position.copy(position);
    anim.positions[data.name] = position;
    anim.radii[data.name] = radius;

    // The tail always points directly away from the sun — not backwards along
    // the orbit. That is why a comet leads with its tail on the way out.
    const activity = cometActivity(distanceAu);
    const length = TAIL_MAX * activity;
    antiSun.copy(position).normalize();

    if (tail.current) {
      tail.current.visible = activity > 0.01;
      const attr = tailGeometry.getAttribute("position") as BufferAttribute;
      const array = attr.array as Float32Array;
      for (let i = 0; i < tailShape.length; i++) {
        const t = tailShape[i];
        const d = t.along * length;
        array[i * 3] = antiSun.x * d + t.spreadX * length * 0.16;
        array[i * 3 + 1] = antiSun.y * d + t.spreadY * length * 0.16;
        array[i * 3 + 2] = antiSun.z * d + t.spreadZ * length * 0.16;
      }
      attr.needsUpdate = true;
      const material = tail.current.material as PointsMaterial;
      material.opacity = 0.5 * activity;
    }

    if (nucleus.current) {
      const material = nucleus.current.material as MeshStandardMaterial;
      material.emissiveIntensity = 0.3 + activity * 0.9;
    }

    if (path.current && showOrbits && Math.abs(blend - pathState.current) > 0.0015) {
      pathState.current = blend;
      const attr = pathGeometry.getAttribute("position") as BufferAttribute;
      warpPath(auPath, attr.array as Float32Array, blend);
      attr.needsUpdate = true;
    }
  });

  const isFocused = focused === data.name;

  return (
    <>
      {showOrbits && (
        <lineLoop ref={path} geometry={pathGeometry} frustumCulled={false}>
          <lineBasicMaterial
            color={isFocused ? "#a8d8f0" : "#3d5570"}
            transparent
            opacity={isFocused ? 0.85 : 0.3}
          />
        </lineLoop>
      )}

      <group ref={group}>
        <mesh
          ref={nucleus}
          onClick={(e) => {
            e.stopPropagation();
            setFocused(data.name);
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHovered(true);
          }}
          onPointerOut={() => setHovered(false)}
        >
          <sphereGeometry args={[radius, 16, 16]} />
          <meshStandardMaterial color={data.color} emissive={data.color} roughness={1} />
        </mesh>

        <points ref={tail} geometry={tailGeometry} frustumCulled={false} raycast={() => null}>
          <pointsMaterial
            color={data.color}
            size={2.2}
            sizeAttenuation={false}
            transparent
            opacity={0.5}
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </points>
      </group>
    </>
  );
}
