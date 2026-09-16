"use client";

import { useMemo, useRef, useState } from "react";
import { useCursor } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { BufferAttribute, BufferGeometry, Group, LineLoop, Mesh, Vector3 } from "three";
import { elementsOf, type PlanetData } from "@/lib/planets";
import { moonsOf } from "@/lib/moons";
import { DEG, orbitPath, positionAt } from "@/lib/kepler";
import { anim, safeDelta, useSolar } from "@/lib/store";
import { displayRadius, spinAngularSpeed, warpPath, warpVector } from "@/lib/scale";
import { bodyTexture } from "@/lib/texture";
import Moon from "./Moon";
import Rings from "./Rings";

const PATH_SEGMENTS = 320;

export default function Planet({ data }: { data: PlanetData }) {
  const orbit = useRef<Group>(null);
  const wobbleGroup = useRef<Group>(null);
  const body = useRef<Mesh>(null);
  const path = useRef<LineLoop>(null);
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);

  const speed = useSolar((s) => s.speed);
  const focused = useSolar((s) => s.focused);
  const setFocused = useSolar((s) => s.setFocused);
  const showOrbits = useSolar((s) => s.showOrbits);
  const showMoons = useSolar((s) => s.showMoons);
  const trueSizes = useSolar((s) => s.trueSizes);
  const trueSpin = useSolar((s) => s.trueSpin);

  const local = useRef(new Vector3()).current;
  const wobble = useRef(new Vector3()).current;
  const spin = useRef(0);

  // Redrawing 320 warped points every frame for every body is wasted work: the
  // shape only moves when the scale is tweening or the orbit has precessed a
  // measurable amount. ponytail: refresh on change, not on a timer.
  const pathState = useRef({ blend: -1, years: -1e9 });
  const auPath = useMemo(() => new Float32Array(PATH_SEGMENTS * 3), []);
  const pathGeometry = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(PATH_SEGMENTS * 3), 3));
    return g;
  }, []);

  const radius = displayRadius(data.diameterKm, trueSizes);
  const texture = useMemo(
    () => bodyTexture(data.color, data.type, data.name),
    [data.color, data.type, data.name],
  );
  const moons = moonsOf(data.name);
  // Mass of the planet alone: a moon displaces it by (m_moon / m_planet) of
  // its own drawn orbit radius, which is how Pluto ends up visibly circling a
  // point in open space rather than sitting still.
  const moonPull = useMemo(
    () => moons.map((m) => ({ name: m.name, ratio: m.massKg / data.massKg })),
    [moons, data.massKg],
  );

  useFrame((_, delta) => {
    anim.radii[data.name] = radius;
    const dt = safeDelta(delta);
    const years = anim.simYears;
    const blend = anim.scaleBlend;

    // Elements are re-derived from the clock every frame, so the orbit
    // precesses instead of being frozen at J2000.
    const el = elementsOf(data, years);

    if (orbit.current) {
      positionAt(el, el.m0Deg * DEG, local);
      warpVector(local, blend);
      orbit.current.position.copy(local);
      anim.positions[data.name] = orbit.current.position;
    }

    if (body.current) {
      spin.current +=
        spinAngularSpeed(data.dayDays, data.retrograde, trueSpin ? data.orbitYears : undefined) *
        speed *
        dt;
      body.current.rotation.y = spin.current;
    }

    // Barycentre wobble: displace the planet opposite its moons.
    if (wobbleGroup.current) {
      wobble.set(0, 0, 0);
      for (const m of moonPull) {
        const lp = anim.moonLocal[m.name];
        if (lp) wobble.addScaledVector(lp, -m.ratio);
      }
      wobbleGroup.current.position.copy(wobble);
    }

    if (path.current && showOrbits) {
      const st = pathState.current;
      if (Math.abs(blend - st.blend) > 0.0015 || Math.abs(years - st.years) > 0.25) {
        st.blend = blend;
        st.years = years;
        auPath.set(orbitPath(el, PATH_SEGMENTS));
        const attr = pathGeometry.getAttribute("position") as BufferAttribute;
        warpPath(auPath, attr.array as Float32Array, blend);
        attr.needsUpdate = true;
      }
    }
  });

  const isFocused = focused === data.name;
  const isDwarf = data.kind === "dwarf";

  return (
    <>
      {showOrbits && (
        <lineLoop ref={path} geometry={pathGeometry} frustumCulled={false}>
          <lineBasicMaterial
            color={isFocused ? "#7f9fe0" : isDwarf ? "#2b3350" : "#33406a"}
            transparent
            opacity={isFocused ? 0.9 : isDwarf ? 0.35 : 0.45}
          />
        </lineLoop>
      )}

      <group ref={orbit}>
        {/* Everything that shares the planet's equator goes inside the tilt:
            its spin axis, its rings and its regular moons. This is why Uranus
            and its whole moon system lie on their side. */}
        <group rotation-z={data.axialTilt * DEG}>
          {/* The planet and its rings wobble about the barycentre; the moons
              do not, because the barycentre is what they orbit. */}
          <group ref={wobbleGroup}>
            <mesh
              ref={body}
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
              <sphereGeometry args={[radius, 48, 48]} />
              <meshStandardMaterial
                map={texture}
                color={texture ? "#ffffff" : data.color}
                roughness={0.85}
                metalness={0}
                emissive={data.color}
                emissiveIntensity={hovered || isFocused ? 0.3 : 0.05}
              />
            </mesh>

            {data.rings && (
              <Rings
                rings={data.rings}
                parentSceneRadius={radius}
                parentDiameterKm={data.diameterKm}
              />
            )}
          </group>

          {showMoons &&
            moons.map((moon, i) => (
              <Moon key={moon.name} data={moon} parent={data} parentSceneRadius={radius} index={i} />
            ))}
        </group>
      </group>
    </>
  );
}
