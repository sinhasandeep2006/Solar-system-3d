import { create } from "zustand";
import type { Vector3 } from "three";

export type ScaleMode = "compressed" | "true";

export type ToggleKey =
  | "showOrbits"
  | "showMoons"
  | "showBelts"
  | "showDwarfs"
  | "showComets"
  | "showLabels"
  | "trueSizes"
  | "trueSpin";

type SolarState = {
  focused: string | null;
  scaleMode: ScaleMode;
  speed: number;
  showOrbits: boolean;
  showMoons: boolean;
  showBelts: boolean;
  showDwarfs: boolean;
  showComets: boolean;
  showLabels: boolean;
  /** Draw bodies at real relative diameters instead of the cosmetic curve. */
  trueSizes: boolean;
  /** Lock spin to the orbit: Earth turns exactly 365.25 times per lap. */
  trueSpin: boolean;
  /** Time-travel panel (date, pause, reverse). Opt-in, closed by default. */
  showTime: boolean;
  setShowTime: (open: boolean) => void;
  /** Which body's apparent path from Earth the sky chart is showing. */
  skyBody: string | null;
  /**
   * The clock reading when the chart was opened. Captured here rather than in
   * an effect so the chart window stays put instead of crawling along with
   * time, and so opening it needs no render cascade.
   */
  skyAnchorYears: number;
  setSkyBody: (name: string | null) => void;
  setFocused: (name: string | null) => void;
  setScaleMode: (mode: ScaleMode) => void;
  setSpeed: (speed: number) => void;
  toggle: (key: ToggleKey) => void;
};

export const useSolar = create<SolarState>((set) => ({
  focused: null,
  scaleMode: "compressed",
  speed: 1,
  showOrbits: true,
  showMoons: true,
  showBelts: true,
  showDwarfs: true,
  showComets: true,
  showLabels: true,
  trueSizes: false,
  trueSpin: false,
  showTime: false,
  setShowTime: (showTime) => set({ showTime }),
  skyBody: null,
  skyAnchorYears: 0,
  setSkyBody: (skyBody) => set({ skyBody, skyAnchorYears: anim.simYears }),
  setFocused: (focused) => set({ focused }),
  setScaleMode: (scaleMode) => set({ scaleMode }),
  setSpeed: (speed) => set({ speed }),
  toggle: (key) => set((s) => ({ [key]: !s[key] }) as Pick<SolarState, ToggleKey>),
}));

/**
 * Per-frame values that must NOT live in the store: writing them through
 * zustand would re-render every subscriber 60x a second. Bodies write here
 * in useFrame, the camera rig and the label layer read it in useFrame.
 * ponytail: module-level singleton, fine for one scene per page. Move to a
 * React context if you ever mount two Canvases at once.
 */
export const anim = {
  /** 0 = compressed, 1 = true scale. Damped by <ScaleTweener>. */
  scaleBlend: 0,
  /**
   * Simulated years since J2000, advanced by <Clock>. Every body derives its
   * position from this single number rather than integrating its own angle,
   * so nothing can drift out of step and the orbits can precess coherently.
   */
  simYears: 0,
  /** Live WORLD position of every focusable body — mutated in place. */
  positions: {} as Record<string, Vector3>,
  /** Moon positions relative to their parent, for the barycentre wobble. */
  moonLocal: {} as Record<string, Vector3>,
  /** Drawn radius of every focusable body, for framing the camera. */
  radii: {} as Record<string, number>,
};

/** Frame-rate independent exponential approach. Same curve at 30fps or 144fps. */
export const damp = (current: number, target: number, lambda: number, dt: number) =>
  current + (target - current) * (1 - Math.exp(-lambda * dt));

/** A backgrounded tab returns one huge delta that would teleport everything. */
export const safeDelta = (delta: number) => Math.min(delta, 0.1);
