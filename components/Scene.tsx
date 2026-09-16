"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { AdditiveBlending, BackSide } from "three";
import { aphelionAu, BODIES, DWARFS, PLANETS } from "@/lib/planets";
import { anim, damp, safeDelta, useSolar } from "@/lib/store";
import { COMETS } from "@/lib/comets";
import { dateToSimYears } from "@/lib/time";
import { readDeepLink, writeDeepLink } from "@/lib/deeplink";
import { useEffect } from "react";
import { ASTEROID_BELT, drawRadius, EARTH_YEAR_SECONDS, KUIPER_BELT, SUN_RADIUS } from "@/lib/scale";
import Planet from "./Planet";
import Comet from "./Comet";
import Belt from "./Belt";
import CameraRig from "./CameraRig";
import LabelProjector from "./LabelProjector";
import Overlay from "./Overlay";

function Sun() {
  const setFocused = useSolar((s) => s.setFocused);
  return (
    <group>
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          setFocused(null);
        }}
      >
        <sphereGeometry args={[SUN_RADIUS, 64, 64]} />
        <meshBasicMaterial color="#ffcc55" toneMapped={false} />
      </mesh>
      {/* Halo shell under the bloom pass: bloom alone leaves a hard edge. */}
      <mesh scale={1.4} raycast={() => null}>
        <sphereGeometry args={[SUN_RADIUS, 32, 32]} />
        <meshBasicMaterial
          color="#ff9420"
          transparent
          opacity={0.16}
          blending={AdditiveBlending}
          depthWrite={false}
          side={BackSide}
          toneMapped={false}
        />
      </mesh>
      {/* decay={0} so brightness stays usable out at Neptune's orbit */}
      <pointLight intensity={2.2} decay={0} color="#fff3d6" />
    </group>
  );
}

/**
 * The single clock every body reads. Positions are derived from simYears
 * rather than integrated per body, so nothing drifts out of step and the
 * orbits can precess coherently.
 */
function Clock() {
  const speed = useSolar((s) => s.speed);
  const scaleMode = useSolar((s) => s.scaleMode);
  // Start at today rather than J2000, then let a ?date= in the link override
  // it. In an effect, not during render: the server has no business baking a
  // build-time date into the page, and this mutates shared state.
  useEffect(() => {
    anim.simYears = dateToSimYears(new Date());
    readDeepLink();
  }, []);

  useFrame((_, delta) => {
    const dt = safeDelta(delta);
    anim.simYears += (dt / EARTH_YEAR_SECONDS) * speed;
    anim.scaleBlend = damp(anim.scaleBlend, scaleMode === "true" ? 1 : 0, 1.1, dt);
  });
  return null;
}

/** Keeps the address bar in step with the view, at a human rate. */
function DeepLinkSync() {
  useEffect(() => {
    const id = setInterval(writeDeepLink, 700);
    return () => clearInterval(id);
  }, []);
  return null;
}

// Eris at aphelion sets the outer edge: 67.9 AU mean, but e=0.44 takes it out
// to 97.5 AU, which is what the far plane and the starfield have to cover.
const MAX_RADIUS = Math.max(...BODIES.map((b) => drawRadius(aphelionAu(b), 1)));

export default function Scene() {
  const setFocused = useSolar((s) => s.setFocused);
  const showBelts = useSolar((s) => s.showBelts);
  const showComets = useSolar((s) => s.showComets);
  const showDwarfs = useSolar((s) => s.showDwarfs);

  return (
    <div id="scene">
      <Canvas
        camera={{ position: [0, 26, 64], fov: 50, near: 0.05, far: MAX_RADIUS * 8 }}
        gl={{ logarithmicDepthBuffer: true }}
        onPointerMissed={() => setFocused(null)}
      >
        <color attach="background" args={["#05060a"]} />
        <ambientLight intensity={0.12} />
        <Stars radius={MAX_RADIUS * 2} depth={MAX_RADIUS / 2} count={9000} factor={26} fade speed={0} />

        <Sun />
        {PLANETS.map((p) => (
          <Planet key={p.name} data={p} />
        ))}
        {showDwarfs && DWARFS.map((p) => <Planet key={p.name} data={p} />)}

        {showComets && COMETS.map((c) => <Comet key={c.name} data={c} />)}

        {showBelts && (
          <>
            <Belt {...ASTEROID_BELT} color="#9a8b72" size={1.7} opacity={0.75} seed={7} />
            <Belt {...KUIPER_BELT} color="#75839f" size={1.3} opacity={0.3} seed={23} />
          </>
        )}

        <Clock />
        <DeepLinkSync />
        <OrbitControls makeDefault enablePan={false} minDistance={0.1} maxDistance={MAX_RADIUS * 3} />
        <CameraRig />
        <LabelProjector />

        {/* Bloom only catches the sun, which is the one thing drawn above 1.0
            with toneMapped={false}. luminanceThreshold keeps planets crisp. */}
        <EffectComposer>
          <Bloom intensity={1.1} luminanceThreshold={0.62} luminanceSmoothing={0.25} mipmapBlur />
        </EffectComposer>
      </Canvas>
      <Overlay />
    </div>
  );
}
