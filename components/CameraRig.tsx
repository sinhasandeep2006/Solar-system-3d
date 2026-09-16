"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import { anim, damp, useSolar } from "@/lib/store";
import { drawRadius, SUN_RADIUS } from "@/lib/scale";
import { aphelionAu, BODIES } from "@/lib/planets";

/** Minimal slice of drei's OrbitControls we touch — avoids a three-stdlib import. */
type Controls = { target: Vector3; update: () => void } | null;

export default function CameraRig() {
  const controls = useThree((s) => s.controls) as Controls;
  const camera = useThree((s) => s.camera);
  const focused = useSolar((s) => s.focused);
  const scaleMode = useSolar((s) => s.scaleMode);
  const showDwarfs = useSolar((s) => s.showDwarfs);

  // Only drive the camera while flying; afterwards OrbitControls is the user's.
  const flying = useRef(true);
  useEffect(() => {
    flying.current = true;
  }, [focused, scaleMode, showDwarfs]);

  // Scratch vectors reused every frame — useRef, not useMemo: these are mutated.
  const wantPos = useRef(new Vector3()).current;
  const wantTarget = useRef(new Vector3()).current;

  useFrame((_, delta) => {
    if (!controls) return;
    const dt = Math.min(delta, 0.1);
    const here = focused ? anim.positions[focused] : undefined;

    if (here) {
      const r = anim.radii[focused!] ?? 0.5;
      wantTarget.copy(here);
      // Sit outside the body along the sun->body line, slightly above it.
      wantPos.copy(here).setY(0).normalize().multiplyScalar(here.length() + r * 8);
      wantPos.y = r * 3.5;
    } else {
      wantTarget.set(0, 0, 0);
      // Frame whatever is on show, but capped.
      //
      // Framing Eris's full 97 AU aphelion shrinks the eight planets to a knot
      // in the middle, and framing Neptune alone pushes Haumea and Makemake
      // off the edge. The cap covers every dwarf BODY — Pluto, Haumea and
      // Makemake orbits fit entirely, and Eris is in frame for most of its
      // orbit — while keeping the planets large enough to read. Only the far
      // arc of Eris's path runs off screen, and scrolling out reveals it.
      let planetEdge = SUN_RADIUS;
      let shownEdge = SUN_RADIUS;
      for (const b of BODIES) {
        const edge = drawRadius(aphelionAu(b, anim.simYears), anim.scaleBlend);
        if (b.kind === "planet") planetEdge = Math.max(planetEdge, edge);
        if (b.kind === "planet" || showDwarfs) shownEdge = Math.max(shownEdge, edge);
      }
      const systemEdge = Math.min(shownEdge, planetEdge * 1.7);
      wantPos.set(0, systemEdge * 0.62, systemEdge * 1.62);
    }

    // The target always follows, so a focused body stays centred as it orbits.
    wantTarget.set(
      damp(controls.target.x, wantTarget.x, 4, dt),
      damp(controls.target.y, wantTarget.y, 4, dt),
      damp(controls.target.z, wantTarget.z, 4, dt),
    );
    controls.target.copy(wantTarget);

    if (flying.current) {
      camera.position.set(
        damp(camera.position.x, wantPos.x, 2.2, dt),
        damp(camera.position.y, wantPos.y, 2.2, dt),
        damp(camera.position.z, wantPos.z, 2.2, dt),
      );
      // Arrival tolerance scales with distance so the fly-out doesn't crawl.
      if (camera.position.distanceTo(wantPos) < Math.max(0.05, wantPos.length() * 0.01)) {
        flying.current = false;
      }
    }
    controls.update();
  });

  return null;
}
