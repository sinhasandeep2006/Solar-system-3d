import { BODIES } from "./planets";
import { MOONS } from "./moons";

export type LabelEntry = {
  name: string;
  isDwarf: boolean;
  isMoon: boolean;
  parent?: string;
};

/**
 * Every label, in placement priority order. The declutter drops whatever comes
 * later, so this ordering decides who wins when two names collide.
 *
 * Planets first, largest first, then dwarfs, then moons. Size order matters:
 * with the array in orbital order, Mercury claimed the spot and Jupiter — far
 * more prominent on screen — was the one that got dropped.
 */
const bySize = (kind: string) =>
  BODIES.filter((b) => b.kind === kind)
    .slice()
    .sort((a, b) => b.diameterKm - a.diameterKm)
    .map((b) => ({ name: b.name, isDwarf: kind === "dwarf", isMoon: false }));

export const LABELS: LabelEntry[] = [
  ...bySize("planet"),
  ...bySize("dwarf"),
  ...MOONS.slice()
    .sort((a, b) => b.diameterKm - a.diameterKm)
    .map((m) => ({ name: m.name, isDwarf: false, isMoon: true, parent: m.parent })),
];

/**
 * Live DOM nodes for the labels. They are rendered as ordinary HTML in the
 * overlay, outside the Canvas, and a component inside the Canvas writes their
 * transforms every frame. Keeping them out of drei's <Html> avoids fighting
 * the wrapper transform it applies, and means the coordinates written here are
 * plain screen pixels.
 */
export const labelNodes: Record<string, HTMLElement | null> = {};
