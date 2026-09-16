"use client";

import { useMemo } from "react";
import { PLANETS } from "@/lib/planets";
import { geocentricTrack, retrogradeSpans, shortestDelta, synodicYears } from "@/lib/retrograde";
import { useSolar } from "@/lib/store";
import { formatDate } from "@/lib/time";

const SAMPLES = 420;
const W = 300;
const H = 150;
const PAD = 6;

/**
 * The apparent path of a planet across the sky, as seen from Earth.
 *
 * Every few months an outer planet stops, backs up for weeks, and resumes.
 * This is the observation that geocentric astronomy kept bolting epicycles on
 * to explain, and it falls straight out of two heliocentric ellipses: Earth is
 * on the shorter, faster orbit and overtakes on the inside.
 */
export default function SkyChart() {
  const skyBody = useSolar((s) => s.skyBody);
  const setSkyBody = useSolar((s) => s.setSkyBody);
  // Captured when the chart was opened, so the window does not crawl along
  // with the clock while you watch it.
  const anchorYears = useSolar((s) => s.skyAnchorYears);

  const body = PLANETS.find((p) => p.name === skyBody);

  const chart = useMemo(() => {
    if (!body) return null;

    // Two passes. A planet drifts hundreds of degrees eastward between
    // reversals, so a window sized to the synodic period squashes the loop —
    // the thing you came to see — into an invisible hook. So: scan wide to
    // find the reversals, then re-sample tightly around the one nearest the
    // clock, where the loop fills the frame.
    const synodic = synodicYears(body);
    const scan = geocentricTrack(body, anchorYears - synodic, anchorYears + synodic, 700);
    const scanSpans = retrogradeSpans(scan).filter(
      ([a, b]) => a > 0 && b < scan.length - 1,
    );

    let from: number;
    let to: number;
    if (scanSpans.length > 0) {
      const nearest = scanSpans.reduce((best, span) => {
        const mid = (scan[span[0]].years + scan[span[1]].years) / 2;
        const bestMid = (scan[best[0]].years + scan[best[1]].years) / 2;
        return Math.abs(mid - anchorYears) < Math.abs(bestMid - anchorYears) ? span : best;
      }, scanSpans[0]);
      const start = scan[nearest[0]].years;
      const end = scan[nearest[1]].years;
      const pad = (end - start) * 1.1;
      from = start - pad;
      to = end + pad;
    } else {
      from = anchorYears - Math.min(synodic * 0.5, 1.5);
      to = anchorYears + Math.min(synodic * 0.5, 1.5);
    }

    const track = geocentricTrack(body, from, to, SAMPLES);

    // Longitude wraps at 360; unwrap it so the curve stays continuous.
    let unwrapped = track[0].lonDeg;
    const points = track.map((p, i) => {
      if (i > 0) unwrapped += shortestDelta(track[i - 1].lonDeg, p.lonDeg);
      return { x: unwrapped, y: p.latDeg, retrograde: p.retrograde };
    });

    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const spanX = Math.max(maxX - minX, 1e-6);
    const spanY = Math.max(maxY - minY, 1e-6);

    const sx = (x: number) => PAD + ((x - minX) / spanX) * (W - PAD * 2);
    const sy = (y: number) => H - PAD - ((y - minY) / spanY) * (H - PAD * 2);

    const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`).join(" ");
    const loops = retrogradeSpans(track).map(([a, b]) =>
      points
        .slice(a, b + 1)
        .map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`)
        .join(" "),
    );

    return {
      path,
      loops,
      from,
      to,
      spanX,
      spanY,
      count: retrogradeSpans(track).length,
    };
  }, [body, anchorYears]);

  if (!body || !chart) return null;

  return (
    <aside className="hud hud-sky">
      <div className="sky-head">
        <p className="kicker">Seen from Earth</p>
        <button className="close" onClick={() => setSkyBody(null)} aria-label="Close sky chart">
          ×
        </button>
      </div>
      <h2 style={{ color: body.color }}>{body.name} in the sky</h2>

      <svg viewBox={`0 0 ${W} ${H}`} className="sky-svg" role="img" aria-label={`Apparent path of ${body.name}`}>
        <rect x="0" y="0" width={W} height={H} rx="6" className="sky-bg" />
        <path d={chart.path} className="sky-track" />
        {chart.loops.map((d, i) => (
          <path key={i} d={d} className="sky-retro" />
        ))}
      </svg>

      <p className="sky-legend">
        <span className="swatch prograde" /> normal, eastward
        <span className="swatch retro" /> retrograde
      </p>

      <dl className="sky-facts">
        <dt>Window</dt>
        <dd>
          {formatDate(chart.from)} – {formatDate(chart.to)}
        </dd>
        <dt>Reversals in window</dt>
        <dd>{chart.count}</dd>
        <dt>Repeats every</dt>
        <dd>{synodicYears(body).toFixed(2)} years</dd>
        <dt>Sky covered</dt>
        <dd>
          {chart.spanX.toFixed(1)}° long × {chart.spanY.toFixed(1)}° lat
        </dd>
      </dl>

      <p className="note-body">
        {body.orbitYears > 1
          ? "Earth is on the inside track and laps it. While we overtake, it appears to slide backwards — the loop you can see above."
          : "This one overtakes us, passing between Earth and the sun. That is when it appears to reverse, and why it is never far from the sun in the sky."}
      </p>

      <div className="sky-picker">
        {PLANETS.filter((p) => p.name !== "Earth").map((p) => (
          <button
            key={p.name}
            className={p.name === skyBody ? "chip on" : "chip"}
            onClick={() => setSkyBody(p.name)}
          >
            {p.name}
          </button>
        ))}
      </div>
    </aside>
  );
}
