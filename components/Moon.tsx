"use client";

import { useMemo, useRef, useState } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useCursor } from "@react-three/drei";
import { BufferGeometry, Float32BufferAttribute, Group, Vector3 } from "three";
import type { MoonData } from "@/lib/moons";
import type { PlanetData } from "@/lib/planets";
import { type Elements, orbitPath, positionAt } from "@/lib/kepler";
import { anim, useSolar } from "@/lib/store";
import { moonDisplayRadius, moonOrbitShape, orbitAngularSpeed, phaseFor } from "@/lib/scale";
import { bodyTexture } from "@/lib/texture";
import { REAL_BUMP, realMapUrl, useRealMap } from "@/lib/skins";
import Atmosphere from "./Atmosphere";

export default function Moon({
  data,
  parent,
  parentSceneRadius,
  index,
}: {
  data: MoonData;
  parent: PlanetData;
  parentSceneRadius: number;
  index: number;
}) {
  const orbit = useRef<Group>(null);
  const world = useRef(new Vector3()).current;
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);

  const focused = useSolar((s) => s.focused);
  const setFocused = useSolar((s) => s.setFocused);
  const showOrbits = useSolar((s) => s.showOrbits);
  const trueSizes = useSolar((s) => s.trueSizes);

  const radius = moonDisplayRadius(parentSceneRadius, data.diameterKm, parent.diameterKm, trueSizes);
  // Ours is the only moon with a published global mosaic. The other 34 get a
  // procedural map at half size — none of them is ever more than a few dozen
  // pixels across.
  const mapUrl = realMapUrl(data.name);
  const real = useRealMap(mapUrl);
  const skin = useMemo(
    () => (mapUrl ? null : bodyTexture(data.color, "Moon", data.name)),
    [mapUrl, data.color, data.name],
  );
  const map = real ?? skin?.map ?? null;
  const shape = moonOrbitShape(parentSceneRadius, data.axisKm, data.e, parent.diameterKm);

  /**
   * Real eccentricity and inclination, arbitrary orientation. Node and
   * periapsis direction precess over months to years for most of these, so a
   * fixed value would be wrong almost immediately — see the note in moons.ts.
   * Inclination is measured from the parent's equator, and this whole group
   * sits inside the planet's axial tilt, so that is exactly what it gets.
   */
  const elements: Elements = useMemo(
    () => ({
      a: shape.a,
      e: shape.e,
      iDeg: data.inclinationDeg,
      nodeDeg: 0,
      periDeg: 0,
      m0Deg: 0,
    }),
    [shape.a, shape.e, data.inclinationDeg],
  );

  const pathGeometry = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(orbitPath(elements, 160), 3));
    return g;
  }, [elements]);

  // Driven by the same clock as the planets, so 13.4 lunar months really do
  // fit inside one Earth year.
  const meanMotion = orbitAngularSpeed(data.orbitDays / 365.25) * (data.retrograde ? -1 : 1);
  const phase = phaseFor(index * 3);

  useFrame(() => {
    anim.radii[data.name] = radius;
    if (!orbit.current) return;
    positionAt(elements, phase + meanMotion * anim.simYears * 12, orbit.current.position);
    // Local feeds the parent's barycentre wobble, world feeds the camera rig.
    anim.moonLocal[data.name] = orbit.current.position;
    anim.positions[data.name] = orbit.current.getWorldPosition(world);
  });

  const isFocused = focused === data.name;
  const parentFocused = focused === parent.name || isFocused;

  return (
    <>
      {/* Moon paths only draw for the body you are looking at — 35 of them at
          once turns every gas giant into a ball of wool. */}
      {showOrbits && parentFocused && (
        <lineLoop geometry={pathGeometry} frustumCulled={false}>
          <lineBasicMaterial color="#5c6a92" transparent opacity={0.45} />
        </lineLoop>
      )}

      <group ref={orbit}>
        <mesh
          onClick={(e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation();
            setFocused(data.name);
          }}
          onPointerOver={(e: ThreeEvent<PointerEvent>) => {
            e.stopPropagation();
            setHovered(true);
          }}
          onPointerOut={() => setHovered(false)}
        >
          <sphereGeometry args={[radius, 32, 32]} />
          {/* Keyed for the same reason as Planet: see the note there. */}
          <meshStandardMaterial
            key={map?.uuid ?? "flat"}
            map={map}
            bumpMap={real ?? skin?.bump ?? null}
            bumpScale={real ? REAL_BUMP.rocky : (skin?.bumpScale ?? 0)}
            color={map ? "#ffffff" : data.color}
            roughness={0.97}
            metalness={0}
            emissive={data.color}
            emissiveIntensity={hovered || isFocused ? 0.45 : 0.05}
          />
        </mesh>

        {/* Titan and Triton are the two out here with an atmosphere. */}
        <Atmosphere name={data.name} radius={radius} />
      </group>
    </>
  );
}
