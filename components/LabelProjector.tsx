"use client";

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import { LABELS, labelNodes } from "@/lib/labels";
import { anim, useSolar } from "@/lib/store";

/** Pixels two labels must keep between them before the later one gives way. */
const MIN_GAP = 34;

/**
 * Where a label may sit relative to its body, in order of preference. Trying
 * below before giving up is what keeps Neptune and Saturn on screen when they
 * sit close to a neighbour — at J2000 Jupiter and Saturn are 8 degrees apart.
 */
const SLOTS = [
  { dy: -1, css: "translate(-50%, -165%)" },
  { dy: 1, css: "translate(-50%, 65%)" },
];
const SLOT_OFFSET = 18;

/**
 * Projects every body to screen space each frame and writes the result
 * straight onto the label DOM nodes — no React render, no drei <Html>.
 *
 * It also declutters. Each body used to own its own <Html>, so Jupiter and
 * Saturn, 8 degrees apart at J2000, printed one on top of the other. Labels
 * are now placed in priority order and any that would land within MIN_GAP of
 * one already placed is hidden.
 */
export default function LabelProjector() {
  const showLabels = useSolar((s) => s.showLabels);
  const showDwarfs = useSolar((s) => s.showDwarfs);
  const showMoons = useSolar((s) => s.showMoons);
  const focused = useSolar((s) => s.focused);

  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  const ndc = useRef(new Vector3()).current;
  const placed = useRef<number[]>([]);

  useFrame(() => {
    placed.current.length = 0;
    const halfW = size.width / 2;
    const halfH = size.height / 2;

    for (const entry of LABELS) {
      const node = labelNodes[entry.name];
      if (!node) continue;

      const world = anim.positions[entry.name];
      // Moons only label the system you are looking at; there is no room for
      // 35 of them at once, and they are the point once you have flown in.
      const allowed =
        showLabels &&
        (!entry.isDwarf || showDwarfs) &&
        (!entry.isMoon ||
          (showMoons && focused !== null && (focused === entry.name || focused === entry.parent)));

      if (!world || !allowed) {
        hide(node);
        continue;
      }

      ndc.copy(world).project(camera);
      const x = (ndc.x + 1) * halfW;
      const y = (1 - ndc.y) * halfH;

      if (ndc.z > 1 || x < 0 || x > size.width || y < 0 || y > size.height) {
        hide(node);
        continue;
      }

      let slot = SLOTS.find((s) => free(placed.current, x, y + s.dy * SLOT_OFFSET));
      // The body you are focused on always keeps its name, crowded or not.
      if (!slot && focused === entry.name) slot = SLOTS[0];
      if (!slot) {
        hide(node);
        continue;
      }

      placed.current.push(x, y + slot.dy * SLOT_OFFSET);
      node.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0) ${slot.css}`;
      node.style.opacity = "1";
      node.style.pointerEvents = "auto";
    }
  });

  return null;
}

function free(placed: number[], x: number, y: number) {
  for (let i = 0; i < placed.length; i += 2) {
    const dx = placed[i] - x;
    const dy = placed[i + 1] - y;
    if (dx * dx + dy * dy < MIN_GAP * MIN_GAP) return false;
  }
  return true;
}

function hide(node: HTMLElement) {
  node.style.opacity = "0";
  node.style.pointerEvents = "none";
}
