"use client";

import { DoubleSide } from "three";
import type { PlanetData } from "@/lib/planets";
import { ringRadius } from "@/lib/scale";

/**
 * Ring bands at their real multiples of the planet radius, drawn as flat
 * annuli in the planet's equatorial plane. Each band is its own mesh so the
 * real gaps between them stay empty — Saturn's Cassini Division is the one
 * you can actually see.
 */
export default function Rings({
  rings,
  parentSceneRadius,
  parentDiameterKm,
}: {
  rings: NonNullable<PlanetData["rings"]>;
  parentSceneRadius: number;
  parentDiameterKm: number;
}) {
  return (
    <group rotation-x={-Math.PI / 2}>
      {rings.bands.map((band) => (
        <mesh key={band.innerKm} raycast={() => null}>
          <ringGeometry
            args={[
              ringRadius(parentSceneRadius, band.innerKm, parentDiameterKm),
              ringRadius(parentSceneRadius, band.outerKm, parentDiameterKm),
              96,
            ]}
          />
          <meshBasicMaterial
            color={rings.color}
            transparent
            opacity={band.opacity}
            side={DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}
