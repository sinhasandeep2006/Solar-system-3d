// Downloads the real surface maps into public/textures/.
//
// Run: npm run textures
//
// These are NOT in the repo by accident if they are missing — they are ~8MB of
// JPEG and the app works without them, falling back to the procedural maps in
// lib/texture.ts. Run this once and they are committed alongside everything
// else, which is the point: no runtime fetch, nothing to 404 in front of a
// user, no CORS.
//
// Sources: solarsystemscope.com/textures (CC BY 4.0) for most, and NASA's own
// New Horizons mosaic for Pluto, which Solar System Scope does not carry.
// See public/textures/NOTICE. Everything except the four "fictional" dwarf
// maps is derived from spacecraft imagery. Those four are artist impressions:
// nothing has resolved Haumea's surface, so nothing honest exists to use.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const SSS = "https://www.solarsystemscope.com/textures/download";
const OUT = path.join(import.meta.dirname, "..", "public", "textures");

/** local name -> source URL */
const FILES = {
  "sun.jpg": `${SSS}/2k_sun.jpg`,
  "mercury.jpg": `${SSS}/2k_mercury.jpg`,
  // The cloud deck, not the radar map of the ground: sulphuric acid is what
  // you would actually see.
  "venus.jpg": `${SSS}/2k_venus_atmosphere.jpg`,
  "earth.jpg": `${SSS}/2k_earth_daymap.jpg`,
  "earth-night.jpg": `${SSS}/2k_earth_nightmap.jpg`,
  "earth-clouds.jpg": `${SSS}/2k_earth_clouds.jpg`,
  "moon.jpg": `${SSS}/2k_moon.jpg`,
  "mars.jpg": `${SSS}/2k_mars.jpg`,
  "jupiter.jpg": `${SSS}/2k_jupiter.jpg`,
  "saturn.jpg": `${SSS}/2k_saturn.jpg`,
  "saturn-rings.png": `${SSS}/2k_saturn_ring_alpha.png`,
  "uranus.jpg": `${SSS}/2k_uranus.jpg`,
  "neptune.jpg": `${SSS}/2k_neptune.jpg`,
  // New Horizons' global colour mosaic, downsampled by Wikimedia's thumbnailer
  // from 5926px. Public domain (NASA/JHUAPL/SwRI) and the only real map of a
  // body nobody had seen before 2015. 1920 rather than 2048 to match the rest:
  // Wikimedia only serves a fixed set of widths and 2048 is not one of them.
  "pluto.jpg":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/Pluto_color_mapmosaic.jpg/1920px-Pluto_color_mapmosaic.jpg",
  "ceres.jpg": `${SSS}/2k_ceres_fictional.jpg`,
  "eris.jpg": `${SSS}/2k_eris_fictional.jpg`,
  "haumea.jpg": `${SSS}/2k_haumea_fictional.jpg`,
  "makemake.jpg": `${SSS}/2k_makemake_fictional.jpg`,
};


const NOTICE = `Surface maps in this directory, and where they come from.

Everything except pluto.jpg:
  https://www.solarsystemscope.com/textures/
  Licensed CC BY 4.0 - https://creativecommons.org/licenses/by/4.0/
  Attribution: Solar System Scope (solarsystemscope.com)
  Most are processed from NASA elevation and imagery data. The four dwarf
  planet maps (ceres, eris, haumea, makemake) are artist impressions - no
  spacecraft has resolved those surfaces.

pluto.jpg:
  NASA New Horizons global colour mosaic, public domain.
  Credit: NASA / Johns Hopkins APL / Southwest Research Institute
  https://www.nasa.gov/image-feature/pluto-global-color-map

Regenerate with: npm run textures
`;

/** A soft 404 is an HTML error page served with a 200, which is a valid JPEG to nobody. */
function looksLikeImage(buf, name) {
  if (name.endsWith(".png")) {
    return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  }
  return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
}

await mkdir(OUT, { recursive: true });
await writeFile(path.join(OUT, "NOTICE"), NOTICE);

let failed = 0;
for (const [local, url] of Object.entries(FILES)) {
  const dest = path.join(OUT, local);
  if (existsSync(dest)) {
    const existing = await readFile(dest);
    if (looksLikeImage(existing, local)) {
      console.log(`  skip  ${local} (${(existing.length / 1024).toFixed(0)}KB)`);
      continue;
    }
  }

  process.stdout.write(`  get   ${local} ... `);
  try {
    // Wikimedia rejects requests without a descriptive User-Agent outright,
    // and node's fetch does not send one.
    const res = await fetch(url, {
      headers: { "User-Agent": "solar-system-viewer/0.1 (texture fetch; local build script)" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (!looksLikeImage(buf, local)) throw new Error(`not an image (${buf.length} bytes)`);
    await writeFile(dest, buf);
    console.log(`${(buf.length / 1024).toFixed(0)}KB`);
  } catch (err) {
    failed++;
    console.log(`FAILED: ${err.message}`);
  }
}

console.log(
  failed
    ? `\n${failed} failed. The app still runs — those bodies keep their procedural map.`
    : `\nAll ${Object.keys(FILES).length} maps present in public/textures/.`,
);
