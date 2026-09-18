"use client";

import { useMemo } from "react";
import { AdditiveBlending, Color } from "three";

/**
 * A lit limb, for the bodies that have air to light.
 *
 * A plain additive shell glows all the way round, which is wrong — the night
 * side of Venus is not a lamp. This shell fades with the viewing angle
 * (Fresnel, so it is brightest where you are looking through the most air, at
 * the edge) AND with the angle to the sun, so the glow tracks the terminator
 * and vanishes round the back.
 *
 * The sun sits at the scene origin, so the light direction is free: it is
 * just the direction back towards 0,0,0 from the fragment.
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
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vPosW = world.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
  #include <logdepthbuf_vertex>
}
`;

const FRAG = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uColor;
uniform float uStrength;
varying vec3 vNormalW;
varying vec3 vPosW;
void main() {
  #include <logdepthbuf_fragment>
  vec3 n = normalize(vNormalW);
  vec3 view = normalize(cameraPosition - vPosW);
  vec3 sun = normalize(-vPosW);
  // Grazing angles look through more atmosphere, so the limb is the bright part.
  float rim = pow(1.0 - max(dot(view, n), 0.0), 2.6);
  // sqrt widens the terminator: air scatters light past the geometric edge.
  float lit = sqrt(max(dot(n, sun), 0.0));
  gl_FragColor = vec4(uColor, rim * lit * uStrength);
}
`;

/**
 * Colour is the scattered light, not the surface: Earth's air is blue because
 * it scatters blue, Mars' is butterscotch because it is full of dust.
 * `height` is the shell radius as a multiple of the body's, exaggerated —
 * Earth's real atmosphere is 1% of its radius and would be invisible.
 */
const AIR: Record<string, { color: string; strength: number; height: number }> = {
  Venus: { color: "#f7e6b4", strength: 1.15, height: 1.06 },
  Earth: { color: "#7fb4ff", strength: 1.1, height: 1.05 },
  Mars: { color: "#e4a582", strength: 0.5, height: 1.04 },
  Jupiter: { color: "#f2d9aa", strength: 0.7, height: 1.03 },
  Saturn: { color: "#f5e6c0", strength: 0.6, height: 1.03 },
  Uranus: { color: "#b6ecf2", strength: 0.85, height: 1.045 },
  Neptune: { color: "#8fa6ff", strength: 0.9, height: 1.045 },
  Pluto: { color: "#dcc6ae", strength: 0.35, height: 1.06 },
  Titan: { color: "#e8a860", strength: 1.0, height: 1.08 },
  Triton: { color: "#cfe0ee", strength: 0.3, height: 1.05 },
};

export default function Atmosphere({ name, radius }: { name: string; radius: number }) {
  const air = AIR[name];
  const uniforms = useMemo(
    () =>
      air
        ? { uColor: { value: new Color(air.color) }, uStrength: { value: air.strength } }
        : undefined,
    [air],
  );
  if (!air || !uniforms) return null;

  return (
    <mesh raycast={() => null}>
      <sphereGeometry args={[radius * air.height, 40, 40]} />
      <shaderMaterial
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </mesh>
  );
}
