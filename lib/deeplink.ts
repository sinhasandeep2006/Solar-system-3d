import { dateToSimYears, toDateInput } from "./time";
import { anim, useSolar, type ScaleMode, type ToggleKey } from "./store";

/**
 * The view state in the URL, so a particular moment can be linked to:
 *   ?focus=Europa&scale=true&date=1986-02-09&speed=0
 *
 * Read once on mount, then written back with replaceState so the address bar
 * tracks the view without filling the history with every slider nudge.
 */

const FLAGS: ToggleKey[] = [
  "showOrbits",
  "showMoons",
  "showBelts",
  "showDwarfs",
  "showComets",
  "showLabels",
  "trueSizes",
  "trueSpin",
];

/** Short names, so a shared link stays readable. */
const FLAG_KEYS: Record<ToggleKey, string> = {
  showOrbits: "orbits",
  showMoons: "moons",
  showBelts: "belts",
  showDwarfs: "dwarfs",
  showComets: "comets",
  showLabels: "labels",
  trueSizes: "sizes",
  trueSpin: "spin",
};

export function readDeepLink() {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const state = useSolar.getState();

  // Date first: setSkyBody captures the clock, so it has to read the right one.
  const date = params.get("date");
  if (date) {
    const parsed = new Date(`${date}T12:00:00Z`);
    if (!Number.isNaN(parsed.getTime())) anim.simYears = dateToSimYears(parsed);
  }

  // A linked date only makes sense with the time panel, so it opens it.
  if (params.get("time") === "1" || date) state.setShowTime(true);

  const focus = params.get("focus");
  if (focus) state.setFocused(focus);

  const sky = params.get("sky");
  if (sky) state.setSkyBody(sky);

  if (params.get("scale") === "true") state.setScaleMode("true");

  const speed = params.get("speed");
  if (speed !== null && Number.isFinite(Number(speed))) state.setSpeed(Number(speed));

  for (const key of FLAGS) {
    const value = params.get(FLAG_KEYS[key]);
    if (value === null) continue;
    const wanted = value !== "0" && value !== "false";
    if (state[key] !== wanted) state.toggle(key);
  }

  return params.has("date");
}

export function writeDeepLink() {
  if (typeof window === "undefined") return;
  const state = useSolar.getState();
  const params = new URLSearchParams();

  if (state.focused) params.set("focus", state.focused);
  if (state.skyBody) params.set("sky", state.skyBody);
  if (state.scaleMode === "true") params.set("scale", "true");
  if (state.speed !== 1) params.set("speed", String(Number(state.speed.toFixed(3))));

  const defaults = useSolar.getInitialState();
  for (const key of FLAGS) {
    if (state[key] !== defaults[key]) params.set(FLAG_KEYS[key], state[key] ? "1" : "0");
  }

  // The date is part of the link only while someone is actually using time
  // travel; otherwise the address bar would tick forward on its own.
  if (state.showTime) {
    params.set("time", "1");
    const date = toDateInput(anim.simYears);
    if (date) params.set("date", date);
  }

  const query = params.toString();
  window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
}

export function scaleModeFrom(value: string | null): ScaleMode {
  return value === "true" ? "true" : "compressed";
}
