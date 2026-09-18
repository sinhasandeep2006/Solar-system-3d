"use client";

import { useMemo } from "react";
import { DoubleSide, RingGeometry } from "three";
import type { PlanetData } from "@/lib/planets";
import { ringRadius } from "@/lib/scale";
import { SATURN_RINGS, useRealMap } from "@/lib/skins";
import { ringTexture } from "@/lib/texture";

/**
 * Ring bands at their real multiples of the planet radius, drawn as flat
 * annuli in the planet's equatorial plane. Each band is its own mesh so the
 * real gaps between them stay empty — Saturn's Cassini Division is the one
 * you can actually see.
 *
 * Saturn gets the real Cassini-derived strip, which is a 2048x125 image
 * running inner edge to outer edge along x. RingGeometry's own UVs are a
 * planar projection and would smear that across the annulus, so the UVs are
 * rebuilt from each vertex's RADIUS instead, mapped into the whole ring
 * system's span. That is what puts every real ringlet and gap at its true
 * distance rather than approximately somewhere.
 *
 * Everything else falls back to the procedural striations in texture.ts.
 *
 * Rings are unlit on purpose: they are near edge-on to the sun much of the
 * time, so a shaded material turns them off entirely, while the real things
 * stay bright because the ice forward-scatters.
 */
export default function Rings({
  name,
  rings,
  parentSceneRadius,
  parentDiameterKm,
}: {
  name: string;
  rings: NonNullable<PlanetData["rings"]>;
  parentSceneRadius: number;
  parentDiameterKm: number;
}) {
  const real = useRealMap(name === "Saturn" ? SATURN_RINGS : null);
  const fallback = ringTexture();

  const geometries = useMemo(() => {
    const spanInner = Math.min(...rings.bands.map((b) => b.innerKm));
    const spanOuter = Math.max(...rings.bands.map((b) => b.outerKm));

    return rings.bands.map((band) => {
      const inner = ringRadius(parentSceneRadius, band.innerKm, parentDiameterKm);
      const outer = ringRadius(parentSceneRadius, band.outerKm, parentDiameterKm);
      const g = new RingGeometry(inner, outer, 192, 1);

      // One ring of vertices at the inner edge and one at the outer, so a
      // linear u across the gap between them is exactly the radial mapping.
      const pos = g.attributes.position;
      const uv = g.attributes.uv;
      for (let i = 0; i < pos.count; i++) {
        const r = Math.hypot(pos.getX(i), pos.getY(i));
        const t = (r - inner) / (outer - inner);
        const km = band.innerKm + t * (band.outerKm - band.innerKm);
        const u = (km - spanInner) / (spanOuter - spanInner);
        uv.setXY(i, Math.min(Math.max(u, 0), 1), 0.5);
      }
      uv.needsUpdate = true;
      return g;
    });
  }, [rings.bands, parentSceneRadius, parentDiameterKm]);

  return (
    <group rotation-x={-Math.PI / 2}>
      {rings.bands.map((band, i) => (
        <mesh key={band.innerKm} geometry={geometries[i]} raycast={() => null}>
          <meshBasicMaterial
            key={(real ?? fallback)?.uuid ?? "flat"}
            map={real ?? fallback}
            // The real strip carries its own colour and opacity; the
            // procedural one is a white mask that needs tinting.
            color={real ? "#ffffff" : rings.color}
            transparent
            opacity={real ? 1 : band.opacity}
            side={DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}
