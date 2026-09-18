"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, type Mesh } from "three";
import { EARTH_CLOUDS, EARTH_NIGHT, useRealMap } from "@/lib/skins";
import { safeDelta, useSolar } from "@/lib/store";

/**
 * The two things that make Earth look like Earth rather than a blue marble:
 * city lights on the dark side, and weather over the ground.
 *
 * Both live INSIDE the planet mesh, so they inherit its spin for free — the
 * lights are bolted to the ground and have to turn with it. The clouds then
 * add a little of their own drift on top.
 */

// The Canvas runs a logarithmic depth buffer (Scene.tsx), so a raw shader has
// to opt into it — three's built-in materials do it through these chunks. Skip
// them and this mesh writes depth on a completely different curve from every
// other object, which shows up as the shell punching through the body it is
// wrapped around. The chunks compile to nothing when the buffer is off.
//
// <common> has to come first: logdepthbuf_vertex calls isPerspectiveMatrix(),
// which is declared in there. Without it the shader does not compile at all.
const VERT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vNormalW;
varying vec3 vPosW;
varying vec2 vUvW;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vPosW = world.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vUvW = uv;
  gl_Position = projectionMatrix * viewMatrix * world;
  #include <logdepthbuf_vertex>
}
`;

const FRAG = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform sampler2D uMap;
uniform float uIntensity;
varying vec3 vNormalW;
varying vec3 vPosW;
varying vec2 vUvW;
void main() {
  #include <logdepthbuf_fragment>
  // Sun is at the scene origin, so this is the light direction for free.
  float lit = dot(normalize(vNormalW), normalize(-vPosW));
  // Lights come up through dusk and are out by full daylight. Without this
  // they burn through the day side, which is the giveaway of a fake Earth.
  float night = smoothstep(0.08, -0.12, lit);
  vec3 lights = texture2D(uMap, vUvW).rgb;
  gl_FragColor = vec4(lights * uIntensity, night);
}
`;

export default function EarthSkin({ radius }: { radius: number }) {
  const clouds = useRef<Mesh>(null);
  const speed = useSolar((s) => s.speed);

  const night = useRealMap(EARTH_NIGHT);
  const cloudMap = useRealMap(EARTH_CLOUDS);

  const uniforms = useMemo(
    () => ({ uMap: { value: night }, uIntensity: { value: 1.6 } }),
    [night],
  );

  // Prograde superrotation: the weather runs a little ahead of the ground.
  // Small enough that a full lap takes weeks of sim time, which is about right.
  useFrame((_, delta) => {
    if (clouds.current) clouds.current.rotation.y += 0.06 * safeDelta(delta) * speed;
  });

  return (
    <>
      {night && (
        <mesh raycast={() => null}>
          <sphereGeometry args={[radius * 1.001, 64, 64]} />
          <shaderMaterial
            vertexShader={VERT}
            fragmentShader={FRAG}
            uniforms={uniforms}
            transparent
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </mesh>
      )}

      {cloudMap && (
        <mesh ref={clouds} raycast={() => null}>
          <sphereGeometry args={[radius * 1.012, 64, 64]} />
          {/* The map is white cloud on black, so it doubles as its own alpha. */}
          <meshStandardMaterial
            map={cloudMap}
            alphaMap={cloudMap}
            transparent
            opacity={0.88}
            depthWrite={false}
            roughness={1}
            metalness={0}
          />
        </mesh>
      )}
    </>
  );
}
