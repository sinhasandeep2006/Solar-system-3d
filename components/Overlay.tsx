"use client";

import { aphelionAu, AU_KM, BODIES, perihelionAu, type PlanetData } from "@/lib/planets";
import { MOONS, moonsOf, type MoonData } from "@/lib/moons";
import { anim, useSolar, type ToggleKey } from "@/lib/store";
import { LABELS, labelNodes } from "@/lib/labels";
import { COMETS } from "@/lib/comets";
import {
  dateToSimYears,
  describeSpeed,
  formatDate,
  isAccurate,
  rawToSpeed,
  speedToRaw,
  SPEED_RAW_MAX,
  toDateInput,
} from "@/lib/time";
import SkyChart from "./SkyChart";
import { useEffect, useState } from "react";

const n = (x: number, digits = 0) =>
  x.toLocaleString("en-US", { maximumFractionDigits: digits });

const km = (x: number) => `${n(x, x < 100 ? 1 : 0)} km`;

const days = (d: number) =>
  d < 2 ? `${n(d * 24, 1)} hours` : `${n(d, 1)} Earth days`;

const years = (y: number) =>
  y < 1 ? `${n(y * 365.25, 1)} Earth days` : `${n(y, 2)} Earth years`;

const mass = (kg: number) => {
  const exp = Math.floor(Math.log10(kg));
  return `${(kg / 10 ** exp).toFixed(2)} x 10^${exp} kg`;
};

const TOGGLES: { key: ToggleKey; label: string; title: string }[] = [
  { key: "showOrbits", label: "Orbits", title: "Draw orbit paths" },
  { key: "showMoons", label: "Moons", title: "Show the 35 major moons" },
  { key: "showBelts", label: "Belts", title: "Asteroid and Kuiper belts" },
  { key: "showDwarfs", label: "Dwarfs", title: "Ceres, Pluto, Haumea, Makemake, Eris" },
  { key: "showComets", label: "Comets", title: "Halley, Encke and Swift-Tuttle, with sunward tails" },
  { key: "showLabels", label: "Labels", title: "Name labels, decluttered" },
  {
    key: "trueSizes",
    label: "True sizes",
    title: "Real diameter ratios instead of the cosmetic curve. Mercury becomes a speck.",
  },
  {
    key: "trueSpin",
    label: "True spin",
    title: "Lock rotation to the orbit: Earth turns 366.25 times per lap, so it blurs.",
  },
];

/**
 * Plain forward speed for everyone. Pausing, reversing and picking a date are
 * time travel, which lives in its own opt-in panel.
 */
function SpeedSlider() {
  const speed = useSolar((s) => s.speed);
  const setSpeed = useSolar((s) => s.setSpeed);
  const direction = speed < 0 ? -1 : 1;
  return (
    <label className="row slider">
      <span>Speed</span>
      <input
        type="range"
        min={0}
        max={SPEED_RAW_MAX}
        step={0.05}
        value={speedToRaw(Math.abs(speed))}
        onChange={(e) => setSpeed(rawToSpeed(Number(e.target.value)) * direction)}
        aria-label="Speed"
      />
      <output>{Math.abs(speed).toFixed(2)}x</output>
    </label>
  );
}

/**
 * The time-travel panel: date, today, pause, reverse. Only mounted when opened,
 * so its clock sampling costs nothing for anyone who never uses it.
 */
function TimePanel() {
  const speed = useSolar((s) => s.speed);
  const setSpeed = useSolar((s) => s.setSpeed);
  const setShowTime = useSolar((s) => s.setShowTime);
  const [years, setYears] = useState(() => anim.simYears);

  useEffect(() => {
    const id = setInterval(() => setYears(anim.simYears), 200);
    return () => clearInterval(id);
  }, []);

  const jump = (next: number) => {
    anim.simYears = next;
    setYears(next);
  };

  return (
    <aside className="hud hud-time">
      <div className="sky-head">
        <p className="kicker">Time travel</p>
        <button className="close" onClick={() => setShowTime(false)} aria-label="Close time travel">
          ×
        </button>
      </div>
      <strong className="date">{formatDate(years)}</strong>

      <label className="row slider">
        <span>Date</span>
        <input
          type="date"
          value={toDateInput(years)}
          onChange={(e) => {
            const parsed = new Date(`${e.target.value}T12:00:00Z`);
            if (!Number.isNaN(parsed.getTime())) jump(dateToSimYears(parsed));
          }}
          aria-label="Jump to date"
        />
      </label>

      <div className="row chips">
        <button className="chip" onClick={() => jump(dateToSimYears(new Date()))}>
          Today
        </button>
        <button className="chip" onClick={() => setSpeed(speed === 0 ? 1 : 0)}>
          {speed === 0 ? "Play" : "Pause"}
        </button>
        <button
          className={speed < 0 ? "chip on" : "chip"}
          onClick={() => setSpeed(speed === 0 ? -1 : -speed)}
          aria-pressed={speed < 0}
        >
          Backwards
        </button>
      </div>

      <p className="note">
        {describeSpeed(speed)}
        {!isAccurate(years) && (
          <span className="warn"> · outside 1800-2050, orbits are extrapolated</span>
        )}
      </p>
    </aside>
  );
}

function Row({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <>
      <dt>{term}</dt>
      <dd>{children}</dd>
    </>
  );
}

function BodyInfo({ body }: { body: PlanetData }) {
  const setFocused = useSolar((s) => s.setFocused);
  const named = moonsOf(body.name);
  return (
    <>
      <p className="kicker">{body.type}</p>
      <h2 style={{ color: body.color }}>{body.name}</h2>
      <dl>
        <Row term="Diameter">{km(body.diameterKm)}</Row>
        <Row term="Mass">{mass(body.massKg)}</Row>
        <Row term="Surface gravity">{body.gravity} m/s²</Row>
        <Row term="Mean temperature">{body.meanTempC} °C</Row>
        <Row term="Semi-major axis">
          {n(body.orbit.a, 3)} AU <span className="dim">({km(body.orbit.a * AU_KM)})</span>
        </Row>
        <Row term="Perihelion / aphelion">
          {n(perihelionAu(body), 2)} – {n(aphelionAu(body), 2)} AU
        </Row>
        <Row term="Eccentricity">
          {body.orbit.e.toFixed(4)}
          {body.orbit.e > 0.15 && <span className="dim"> · markedly elliptical</span>}
        </Row>
        <Row term="Orbital inclination">{n(Math.abs(body.orbit.iDeg), 2)}° to the ecliptic</Row>
        <Row term="Perihelion drift">
          {body.orbit.periLonRate === 0 ? (
            <span className="dim">not modelled</span>
          ) : (
            <>
              {n(body.orbit.periLonRate, 3)}° per century
              <span className="dim"> · the orbit itself turns</span>
            </>
          )}
        </Row>
        <Row term="Day length">
          {days(body.dayDays)}
          {body.retrograde && <span className="dim"> · retrograde spin</span>}
        </Row>
        <Row term="Year length">{years(body.orbitYears)}</Row>
        <Row term="Axial tilt">
          {body.axialTilt}°
          {body.axialTilt > 90 && <span className="dim"> · tipped past vertical</span>}
        </Row>
        <Row term="Rings">
          {body.rings ? `${body.rings.bands.length} band${body.rings.bands.length > 1 ? "s" : ""}` : "None"}
        </Row>
        <Row term={`Moons (${body.moonCount})`}>
          {named.length === 0 ? (
            body.moonCount === 0 ? "None" : `${body.moonCount} known, none major`
          ) : (
            <>
              <span className="moon-list">
                {named.map((m) => (
                  <button key={m.name} className="chip" onClick={() => setFocused(m.name)}>
                    {m.name}
                  </button>
                ))}
              </span>
              {body.moonCount > named.length && (
                <span className="dim">
                  + {body.moonCount - named.length} smaller, not rendered
                </span>
              )}
            </>
          )}
        </Row>
      </dl>
    </>
  );
}

function MoonInfo({ moon }: { moon: MoonData }) {
  const setFocused = useSolar((s) => s.setFocused);
  return (
    <>
      <p className="kicker">Moon of {moon.parent}</p>
      <h2 style={{ color: moon.color }}>{moon.name}</h2>
      <dl>
        <Row term="Diameter">{km(moon.diameterKm)}</Row>
        <Row term="Mass">{mass(moon.massKg)}</Row>
        <Row term={`Distance from ${moon.parent}`}>{km(moon.axisKm)}</Row>
        <Row term="Closest / furthest">
          {km(moon.axisKm * (1 - moon.e))} – {km(moon.axisKm * (1 + moon.e))}
        </Row>
        <Row term="Orbital period">{days(moon.orbitDays)}</Row>
        <Row term="Eccentricity">{moon.e}</Row>
        <Row term="Orbital inclination">{moon.inclinationDeg}° to the equator</Row>
        <Row term="Direction">
          {moon.retrograde ? "Retrograde — orbits backwards" : "Prograde"}
        </Row>
        <Row term="Rotation">
          {moon.locked ? "Tidally locked, one face always inward" : "Not tidally locked"}
        </Row>
        <Row term="Discovered">
          {moon.discoverer}
          {moon.discoveredYear !== null && <span className="dim"> · {moon.discoveredYear}</span>}
        </Row>
        <Row term="Pulls its parent">
          {(() => {
            const parent = BODIES.find((b) => b.name === moon.parent)!;
            const offsetKm = (moon.massKg / (parent.massKg + moon.massKg)) * moon.axisKm;
            const outside = offsetKm > parent.diameterKm / 2;
            return (
              <>
                {km(offsetKm)} off centre
                <span className="dim">
                  {outside ? " · barycentre is outside the planet" : " · barycentre stays inside"}
                </span>
              </>
            );
          })()}
        </Row>
      </dl>
      <p className="note-body">{moon.note}</p>
      <button className="back subtle" onClick={() => setFocused(moon.parent)}>
        ← {moon.parent}
      </button>
    </>
  );
}

function CometInfo({ comet }: { comet: (typeof COMETS)[number] }) {
  const setFocused = useSolar((s) => s.setFocused);
  return (
    <>
      <p className="kicker">Periodic comet</p>
      <h2 style={{ color: comet.color }}>{comet.name}</h2>
      <dl>
        <Row term="Designation">{comet.designation}</Row>
        <Row term="Nucleus">{km(comet.diameterKm)}</Row>
        <Row term="Orbital period">{n(comet.periodYears, 2)} years</Row>
        <Row term="Perihelion / aphelion">
          {n(comet.orbit.a * (1 - comet.orbit.e), 2)} – {n(comet.orbit.a * (1 + comet.orbit.e), 2)} AU
        </Row>
        <Row term="Eccentricity">{comet.orbit.e}</Row>
        <Row term="Inclination">
          {comet.orbit.iDeg}°
          {comet.orbit.iDeg > 90 && <span className="dim"> · orbits backwards</span>}
        </Row>
        <Row term="Last perihelion">{comet.perihelionDate}</Row>
      </dl>
      <p className="note-body">{comet.note}</p>
      <p className="note-body dim">
        Position derived from the passage date and mean period, so good to weeks
        rather than arcseconds. Comet orbits genuinely shift — Jupiter swings
        Halley&apos;s period between 74 and 79 years.
      </p>
      <button className="back subtle" onClick={() => setFocused(null)}>
        ← Back to system
      </button>
    </>
  );
}

export default function Overlay() {
  const focused = useSolar((s) => s.focused);
  const setFocused = useSolar((s) => s.setFocused);
  const scaleMode = useSolar((s) => s.scaleMode);
  const setScaleMode = useSolar((s) => s.setScaleMode);
  const toggle = useSolar((s) => s.toggle);
  const showTime = useSolar((s) => s.showTime);
  const setShowTime = useSolar((s) => s.setShowTime);
  const flags = useSolar((s) => s);

  const body = BODIES.find((b) => b.name === focused);
  const moon = body ? undefined : MOONS.find((m) => m.name === focused);
  const comet = body || moon ? undefined : COMETS.find((c) => c.name === focused);
  const setSkyBody = useSolar((s) => s.setSkyBody);
  // Phones only: the controls hide behind a round button. Desktop CSS ignores it.
  const [controlsOpen, setControlsOpen] = useState(false);

  return (
    <>
      {/* Plain HTML over the canvas; <LabelProjector> inside the Canvas writes
          each span's transform every frame. */}
      <div className="label-layer" aria-hidden>
        {LABELS.map((entry) => (
          <span
            key={entry.name}
            ref={(el) => {
              labelNodes[entry.name] = el;
            }}
            className={`label${entry.isDwarf ? " dwarf" : ""}${entry.isMoon ? " moon" : ""}${
              focused === entry.name ? " on" : ""
            }`}
            style={{ opacity: 0 }}
            onClick={() => setFocused(entry.name)}
          >
            {entry.name}
          </span>
        ))}
      </div>

      <header className="hud hud-top">
        <h1>Solar System Explorer</h1>
        <p>
          Click any body to fly in. Drag to orbit, scroll to zoom.
          <br />
          {BODIES.length} planets and dwarfs · {MOONS.length} major moons · 2 belts
          <br />
          <span className="dim">Real J2000 elements, solved with Kepler&apos;s equation.</span>
        </p>
      </header>

      <button
        className="controls-fab"
        onClick={() => setControlsOpen(!controlsOpen)}
        aria-expanded={controlsOpen}
        aria-controls="controls"
        aria-label={controlsOpen ? "Close controls" : "Open controls"}
      >
        {controlsOpen ? "×" : (
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h12M20 18h0" />
            <circle cx="16" cy="6" r="2" />
            <circle cx="8" cy="12" r="2" />
            <circle cx="18" cy="18" r="2" />
          </svg>
        )}
      </button>

      <div id="controls" className={controlsOpen ? "hud hud-controls open" : "hud hud-controls"}>
        <div className="row" role="group" aria-label="Distance scale">
          <button
            className={scaleMode === "compressed" ? "seg on" : "seg"}
            onClick={() => setScaleMode("compressed")}
            aria-pressed={scaleMode === "compressed"}
          >
            Compressed
          </button>
          <button
            className={scaleMode === "true" ? "seg on" : "seg"}
            onClick={() => setScaleMode("true")}
            aria-pressed={scaleMode === "true"}
          >
            True Scale
          </button>
        </div>

        <SpeedSlider />

        <div className="row chips">
          <button
            className={showTime ? "chip on" : "chip"}
            onClick={() => setShowTime(!showTime)}
            aria-pressed={showTime}
            title="Pick a date, pause, run backwards"
          >
            Time travel
          </button>
        </div>

        <div className="row chips" role="group" aria-label="Layers">
          {TOGGLES.map((t) => (
            <button
              key={t.key}
              className={flags[t.key] ? "chip on" : "chip"}
              onClick={() => toggle(t.key)}
              aria-pressed={flags[t.key]}
              title={t.title}
            >
              {t.label}
            </button>
          ))}
        </div>

        <p className="note">
          {scaleMode === "true"
            ? "Real AU distances, and exact ellipses. The outer system really is that empty."
            : "√r spacing, applied to distance itself — so orbits cross on screen only where they cross in reality, at the cost of looking slightly rounder than they are. True Scale is exact."}
          {" Moon orbits use their own scale: the real Moon would sit inside Earth."}
        </p>
      </div>

      {(body || moon || comet) && (
        <aside className="hud hud-info">
          {body ? (
            <BodyInfo body={body} />
          ) : moon ? (
            <MoonInfo moon={moon} />
          ) : comet ? (
            <CometInfo comet={comet} />
          ) : null}
          {body && body.kind === "planet" && body.name !== "Earth" && (
            <button className="back subtle" onClick={() => setSkyBody(body.name)}>
              See it from Earth →
            </button>
          )}
          {!comet && (
            <button className="back" onClick={() => setFocused(null)}>
              ← Back to system
            </button>
          )}
        </aside>
      )}

      {showTime && <TimePanel />}

      <SkyChart />
    </>
  );
}
