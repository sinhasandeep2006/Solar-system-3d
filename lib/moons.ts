// The major named moons, from the NASA/JPL planetary satellite fact sheets.
//
// axisKm         = semi-major axis around the parent, km
// orbitDays      = sidereal orbital period, Earth days
// e              = orbital eccentricity
// inclinationDeg = tilt of the orbit plane from the parent's equator, 0-90.
//                  The irregular moons are quoted above 90 (Phoebe 173,
//                  Triton 157) but that just means "retrograde, tilted by
//                  180 - i", and direction is carried by the retrograde flag,
//                  so these are the 180 - i values.
// locked         = rotates synchronously, keeping one face to its parent
//
// NOT modelled: the node and periapsis ORIENTATION of each moon orbit. Those
// precess on timescales of months to years, so a fixed J2000 value would be
// wrong almost immediately. The orbit SHAPE (a, e, i) and the period are
// exact; the orientation and the starting phase are arbitrary.
//
// This is 35 of the ~890 known natural satellites. The rest are unnamed
// sub-10km captures whose diameters are estimated or unpublished, so they are
// counted in PlanetData.moonCount but not rendered as bodies.
export type MoonData = {
  name: string;
  parent: string;
  color: string;
  diameterKm: number;
  massKg: number;
  axisKm: number;
  orbitDays: number;
  e: number;
  inclinationDeg: number;
  retrograde: boolean;
  locked: boolean;
  discoverer: string;
  discoveredYear: number | null;
  note: string;
};

type MoonInput = Omit<MoonData, "parent">;

const moon = (
  name: string,
  diameterKm: number,
  massKg: number,
  axisKm: number,
  orbitDays: number,
  e: number,
  inclinationDeg: number,
  color: string,
  discoverer: string,
  discoveredYear: number | null,
  note: string,
  locked = true,
  retrograde = false,
): MoonInput => ({
  name,
  diameterKm,
  massKg,
  axisKm,
  orbitDays,
  e,
  inclinationDeg,
  color,
  discoverer,
  discoveredYear,
  note,
  locked,
  retrograde,
});

// Each list runs inner to outer; a unit test enforces it.
const SYSTEMS: Record<string, MoonInput[]> = {
  Earth: [
    moon("Moon", 3_475, 7.346e22, 384_400, 27.322, 0.0549, 5.15, "#c8c5bd", "Prehistoric", null,
      "The only world beyond Earth that humans have stood on. Receding about 3.8 cm a year."),
  ],

  Mars: [
    moon("Phobos", 22.4, 1.0659e16, 9_376, 0.3189, 0.0151, 1.08, "#8d7d6f", "Asaph Hall", 1877,
      "Orbits below synchronous height, so it rises in the west. Spiralling inward; it will break up in ~50 million years."),
    moon("Deimos", 12.4, 1.4762e15, 23_463, 1.2624, 0.00033, 1.79, "#9a8b7a", "Asaph Hall", 1877,
      "Escape velocity is about 5.6 m/s. You could throw a ball off it."),
  ],

  Jupiter: [
    moon("Amalthea", 167, 2.08e18, 181_400, 0.4982, 0.0032, 0.39, "#a86b52", "E. E. Barnard", 1892,
      "The reddest object in the solar system, probably stained by sulphur from Io."),
    moon("Io", 3_643, 8.932e22, 421_800, 1.7691, 0.0041, 0.04, "#e8d15c", "Galileo Galilei", 1610,
      "Over 400 active volcanoes, the most geologically active body known, heated by tidal flexing."),
    moon("Europa", 3_122, 4.8e22, 671_100, 3.5512, 0.0094, 0.47, "#d9cbb0", "Galileo Galilei", 1610,
      "A salt-water ocean under 15-25 km of ice, holding perhaps twice the water of all Earth's oceans."),
    moon("Ganymede", 5_268, 1.4819e23, 1_070_400, 7.1546, 0.0013, 0.18, "#9c8f80", "Galileo Galilei", 1610,
      "The largest moon in the solar system, bigger than Mercury, and the only one with its own magnetic field."),
    moon("Callisto", 4_821, 1.0759e23, 1_882_700, 16.689, 0.0074, 0.19, "#6e6357", "Galileo Galilei", 1610,
      "The most heavily cratered object known: a surface essentially unchanged for four billion years."),
    moon("Himalia", 170, 4.2e18, 11_461_000, 250.56, 0.1623, 27.5, "#7a736b", "Charles Perrine", 1904,
      "Largest of Jupiter's captured irregular moons.", false),
  ],

  Saturn: [
    moon("Mimas", 396, 3.749e19, 185_540, 0.9424, 0.0196, 1.57, "#b8b4ab", "William Herschel", 1789,
      "Herschel crater spans a third of its diameter. The impact nearly shattered it."),
    moon("Enceladus", 504, 1.08e20, 238_040, 1.3702, 0.0047, 0.0, "#eef1f2", "William Herschel", 1789,
      "Jets water ice from fractures at its south pole, and those jets are what feed Saturn's E ring."),
    moon("Tethys", 1_062, 6.17e20, 294_670, 1.8878, 0.0001, 0.17, "#d2cec4", "G. D. Cassini", 1684,
      "Ithaca Chasma runs three quarters of the way around it. Almost pure water ice."),
    moon("Dione", 1_123, 1.095e21, 377_420, 2.7369, 0.0022, 0.02, "#c6c2b8", "G. D. Cassini", 1684,
      "Bright ice cliffs that Voyager first mistook for wispy clouds."),
    moon("Rhea", 1_527, 2.306e21, 527_070, 4.5175, 0.0013, 0.35, "#bdb9af", "G. D. Cassini", 1672,
      "Saturn's second largest moon, and possibly the only moon with a faint ring of its own."),
    moon("Titan", 5_150, 1.3452e23, 1_221_870, 15.945, 0.0288, 0.33, "#e0a54a", "Christiaan Huygens", 1655,
      "The only moon with a thick atmosphere, and the only other world with standing liquid: lakes of methane and ethane."),
    moon("Hyperion", 270, 5.62e18, 1_481_010, 21.277, 0.123, 0.43, "#a08f76", "Bond and Lassell", 1848,
      "Rotates chaotically. Its orientation is genuinely unpredictable more than a few weeks ahead.", false),
    moon("Iapetus", 1_469, 1.806e21, 3_560_840, 79.322, 0.0283, 8.3, "#9e8f76", "G. D. Cassini", 1671,
      "One hemisphere is as dark as coal, the other as bright as snow. A 13 km ridge runs along its equator."),
    moon("Phoebe", 213, 8.29e18, 12_947_900, 550.31, 0.1562, 7.0, "#5c564f", "W. H. Pickering", 1899,
      "A captured centaur going the wrong way round, shedding the dust that forms Saturn's vast outer ring.",
      false, true),
  ],

  Uranus: [
    moon("Puck", 162, 2.9e18, 86_000, 0.7618, 0.00012, 0.32, "#8a8f91", "Voyager 2", 1985,
      "Spotted by Voyager 2 on its way past, weeks before closest approach."),
    moon("Miranda", 472, 6.59e19, 129_900, 1.4135, 0.0013, 4.23, "#b9c2c4", "Gerard Kuiper", 1948,
      "Verona Rupes is a cliff up to 20 km high, the tallest known anywhere."),
    moon("Ariel", 1_158, 1.353e21, 190_900, 2.5204, 0.0012, 0.26, "#c3cdd0", "William Lassell", 1851,
      "The brightest and youngest-looking Uranian surface, resurfaced by past tidal heating."),
    moon("Umbriel", 1_169, 1.172e21, 266_000, 4.1442, 0.0039, 0.13, "#7f878a", "William Lassell", 1851,
      "The darkest of the five large Uranian moons, with one unexplained bright ring on its limb."),
    moon("Titania", 1_578, 3.527e21, 436_300, 8.7059, 0.0011, 0.34, "#b3bcbe", "William Herschel", 1787,
      "Largest Uranian moon, cut by rift valleys over 1,600 km long."),
    moon("Oberon", 1_523, 3.014e21, 583_500, 13.463, 0.0014, 0.06, "#9aa3a6", "William Herschel", 1787,
      "Crater floors flooded with an unidentified dark material."),
  ],

  Neptune: [
    moon("Larissa", 194, 4.2e18, 73_550, 0.5548, 0.0014, 0.2, "#7d8899", "Reitsema and colleagues", 1981,
      "Found during a stellar occultation, then confirmed by Voyager 2 eight years later."),
    moon("Proteus", 420, 4.4e19, 117_600, 1.1223, 0.0005, 0.52, "#8b95a3", "Voyager 2", 1989,
      "About as large as a body can get while staying irregular rather than pulling itself round."),
    moon("Triton", 2_707, 2.139e22, 354_760, 5.8769, 0.000016, 23.2, "#d5cfc6", "William Lassell", 1846,
      "Orbits backwards, so Neptune captured it from the Kuiper Belt. Nitrogen geysers, and at -235 C the coldest measured surface in the solar system.",
      true, true),
    moon("Nereid", 340, 3.1e19, 5_513_400, 360.13, 0.7507, 32.6, "#767f8c", "Gerard Kuiper", 1949,
      "One of the most eccentric orbits known: it swings between 1.4 and 9.7 million km from Neptune.", false),
  ],

  Pluto: [
    moon("Charon", 1_212, 1.586e21, 19_591, 6.3872, 0.0002, 0.08, "#a8998c", "James Christy", 1978,
      "Half Pluto's diameter. The two are locked to each other and orbit a barycentre out in open space, so Pluto wobbles too."),
    moon("Nix", 49.8, 4.5e16, 48_694, 24.855, 0.002, 0.13, "#b5aa9e", "Hubble team", 2005,
      "Tumbles chaotically, flipping its poles over within a few days.", false),
    moon("Hydra", 50.9, 4.8e16, 64_738, 38.202, 0.0059, 0.24, "#b5aa9e", "Hubble team", 2005,
      "Pluto's outermost known moon, and another chaotic tumbler.", false),
  ],

  Haumea: [
    moon("Namaka", 170, 1.79e18, 25_657, 18.28, 0.249, 13.4, "#dcd6cb", "Brown and colleagues", 2005,
      "Its orbit is strongly perturbed by the larger Hiiaka.", false),
    moon("Hiiaka", 320, 1.79e19, 49_880, 49.12, 0.0513, 13.4, "#dcd6cb", "Brown and colleagues", 2005,
      "Its spectrum shows almost pure water ice, a shard of Haumea's own mantle.", false),
  ],

  Eris: [
    moon("Dysnomia", 615, 8.2e19, 37_273, 15.786, 0.0062, 0.0, "#c9c9c3", "Brown and colleagues", 2005,
      "Tracking its orbit is how we learned that Eris is more massive than Pluto."),
  ],
};

export const MOONS: MoonData[] = Object.entries(SYSTEMS).flatMap(([parent, list]) =>
  list.map((m) => ({ ...m, parent })),
);

export const moonsOf = (parent: string) => MOONS.filter((x) => x.parent === parent);
